// Gerenciador do Quick Time Event (QTE)
// Sequência: W -> D -> (W + S simultâneos) -> A com mecânica de Hold & Release rítmico
//
// Cada golpe é composto por uma ou mais FAIXAS (lanes). Uma faixa = uma tecla com
// seu próprio tempo-alvo de hold, sua própria tolerância e sua própria barra na tela.
// O terceiro golpe usa duas faixas ao mesmo tempo, mas elas são INDEPENDENTES:
// não é preciso pressionar W e S juntos. Cada tecla é julgada só pela própria
// janela de hold — basta as duas caírem dentro do aceito, na ordem que você quiser.

class QTEManager {
  constructor() {
    this.steps = [
      {
        key: 'W',
        code: 'KeyW',
        action: 'HIGH BLOCK',
        targetHoldMs: 680,   // Barra enche quase 2x mais rápido
        baseToleranceMs: 110,
        minToleranceMs: 45,
        baseWidth: 175,
        minWidth: 50,
        maxWaitStartMs: 3000,
        hint: 'BLOCK'
      },
      {
        key: 'D',
        code: 'KeyD',
        action: 'SIDE DODGE',
        targetHoldMs: 480,   // Velocidade rápida de esquiva
        baseToleranceMs: 85,
        minToleranceMs: 38,
        baseWidth: 155,
        minWidth: 45,
        maxWaitStartMs: 2400,
        hint: 'DODGE'
      },
      {
        // GOLPE DE TECLA DUPLA: W e S, cada um com sua janela. Juntos ou um de cada vez.
        action: 'STANCE BREAK',
        keys: [
          {
            key: 'W',
            code: 'KeyW',
            targetHoldMs: 580,   // Trava longa: prende o braço hidráulico
            baseToleranceMs: 130,
            minToleranceMs: 66
          },
          {
            key: 'S',
            code: 'KeyS',
            targetHoldMs: 340,   // Golpe mais curto, com janela própria
            baseToleranceMs: 100,
            minToleranceMs: 50
          }
        ],
        // Prazo para COMEÇAR a segunda tecla. Folgado de propósito: dá para segurar
        // as duas juntas ou resolver uma de cada vez, como preferir.
        secondKeyGraceMs: 3000,
        baseWidth: 165,
        minWidth: 60,
        maxWaitStartMs: 2800,
        hint: 'COUNTER'
      },
      {
        // GOLPE DE SEQUÊNCIA: sem barra e sem segurar. Só martelar as teclas
        // na ordem certa antes do tempo acabar.
        action: 'FINISHING BLOW',
        sequence: ['W', 'S', 'S', 'S', 'A', 'S', 'W', 'D'],
        sequenceTimeMs: 4000,   // Tempo total, contado a partir da 1ª tecla
        startGraceMs: 1400,     // Tempo para começar antes de o relógio disparar
        hint: 'FINISHER'
      }
    ];

    this.currentStepIndex = 0;
    this.isActive = false;
    this.stepStartTime = 0;
    this.firstPressTime = null;   // Momento da primeira tecla do golpe (congela as tolerâncias)
    this.results = [];

    // Elementos da DOM
    this.hudElement = document.getElementById('qte-hud');
    this.actionLabelElement = document.getElementById('qte-action-label');
    this.feedbackElement = document.getElementById('qte-feedback');

    // Faixas físicas disponíveis na tela (a segunda só aparece em golpes duplos)
    this.laneDom = [
      {
        row: document.getElementById('qte-lane-0'),
        keyBox: document.getElementById('qte-key-box'),
        keyLabel: document.getElementById('qte-target-key'),
        meterContainer: document.getElementById('meter-container-0'),
        fill: document.getElementById('meter-fill'),
        needle: document.getElementById('meter-needle'),
        sweetZone: document.getElementById('sweet-zone')
      },
      {
        row: document.getElementById('qte-lane-1'),
        keyBox: document.getElementById('qte-key-box-2'),
        keyLabel: document.getElementById('qte-target-key-2'),
        meterContainer: document.getElementById('meter-container-1'),
        fill: document.getElementById('meter-fill-2'),
        needle: document.getElementById('meter-needle-2'),
        sweetZone: document.getElementById('sweet-zone-2')
      }
    ];

    // Faixas ativas do golpe atual
    this.lanes = [];

    this.lanesWrapper = document.querySelector('.qte-lanes');

    // Estado do golpe de sequência
    this.sequenceContainer = document.getElementById('qte-sequence');
    this.sequenceTimerElement = document.getElementById('seq-timer');
    this.sequenceKeyElements = [];
    this.sequenceIndex = 0;
    this.sequenceStartTime = 0;

    // Callbacks de eventos
    this.onStepSuccess = null;
    this.onLaneSuccess = null;   // Acerto de uma tecla dentro de um golpe de várias
    this.onFail = null;
    this.onComplete = null;

    this.bindEvents();
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
  }

  // Normaliza o golpe: tanto o formato de tecla única quanto o de várias teclas
  // viram a mesma lista de especificações de faixa.
  getStepKeySpecs(step) {
    if (step.keys && step.keys.length) return step.keys;
    return [{
      key: step.key,
      code: step.code,
      targetHoldMs: step.targetHoldMs,
      baseToleranceMs: step.baseToleranceMs,
      minToleranceMs: step.minToleranceMs
    }];
  }

  // Rótulo legível das teclas exigidas pelo golpe ("W", "W + S" ou "W S S S ...")
  getStepKeyLabel(step) {
    if (this.isSequenceStep(step)) return step.sequence.join(' ');
    return this.getStepKeySpecs(step).map((spec) => spec.key).join(' + ');
  }

  isSequenceStep(step) {
    return !!(step && step.sequence && step.sequence.length);
  }

  // Monta a fileira de teclas do golpe de sequência
  buildSequenceRow(step) {
    this.sequenceContainer.innerHTML = '';
    this.sequenceKeyElements = step.sequence.map((key, i) => {
      const el = document.createElement('span');
      el.className = i === 0 ? 'seq-key next' : 'seq-key';
      el.textContent = key;
      this.sequenceContainer.appendChild(el);
      return el;
    });

    const timer = document.createElement('span');
    timer.className = 'seq-timer';
    timer.id = 'seq-timer';
    this.sequenceContainer.appendChild(timer);
    this.sequenceTimerElement = timer;
  }

  // Relógio do golpe de sequência: só corre depois da primeira tecla
  paintSequenceTimer(remainingMs) {
    if (!this.sequenceTimerElement) return;
    const secs = Math.max(0, remainingMs) / 1000;
    this.sequenceTimerElement.textContent = `${secs.toFixed(1)}s`;
    this.sequenceTimerElement.classList.toggle('urgent', secs <= 1.2);
  }

  start() {
    this.isActive = true;
    this.currentStepIndex = 0;
    this.results = [];
    this.hudElement.classList.remove('hidden');
    this.resetStepDots();
    this.loadStep(0);
  }

  stop() {
    this.isActive = false;
    if (this.sequenceContainer) this.sequenceContainer.classList.add('hidden');
    this.releaseAllLanes();
    window.Sound.stopHoldTone();
    this.hudElement.classList.add('hidden');
  }

  releaseAllLanes() {
    this.lanes.forEach((lane) => {
      lane.isHolding = false;
    });
  }

  anyLaneHolding() {
    return this.lanes.some((lane) => lane.isHolding);
  }

  resetStepDots() {
    for (let i = 0; i < 4; i++) {
      const dot = document.getElementById(`step-dot-${i}`);
      if (dot) {
        dot.className = 'dot';
      }
    }
  }

  loadStep(index) {
    if (index >= this.steps.length) {
      this.finishSuccess();
      return;
    }

    this.currentStepIndex = index;
    const step = this.steps[index];

    this.stepStartTime = performance.now();
    this.firstPressTime = null;

    // Atualiza Dot de progresso
    const progressDot = document.getElementById(`step-dot-${index}`);
    if (progressDot) progressDot.classList.add('active');

    // GOLPE DE SEQUÊNCIA: nenhuma faixa, nenhuma barra — só a fileira de teclas
    if (this.isSequenceStep(step)) {
      this.lanes = [];
      this.sequenceIndex = 0;
      this.sequenceStartTime = 0;

      this.laneDom.forEach((dom) => {
        if (dom.row) dom.row.classList.add('hidden');
      });
      this.lanesWrapper.classList.add('hidden');

      this.buildSequenceRow(step);
      this.sequenceContainer.classList.remove('hidden');
      this.paintSequenceTimer(step.sequenceTimeMs);

      this.actionLabelElement.textContent = `${index + 1}/4 - ${step.action} [SEQUENCE]`;
      this.clearFeedback();
      return;
    }

    this.sequenceContainer.classList.add('hidden');
    this.lanesWrapper.classList.remove('hidden');

    const specs = this.getStepKeySpecs(step);

    // Monta uma faixa ativa por tecla exigida
    this.lanes = specs.map((spec, i) => ({
      spec,
      dom: this.laneDom[i],
      pressed: false,
      isHolding: false,
      done: false,
      holdStartTime: 0,
      currentToleranceMs: spec.baseToleranceMs,
      activeToleranceMs: spec.baseToleranceMs,
      currentWidth: step.baseWidth
    }));

    // Mostra apenas as faixas usadas por este golpe
    this.laneDom.forEach((dom, i) => {
      if (!dom.row) return;
      dom.row.classList.toggle('hidden', i >= this.lanes.length);
      dom.row.classList.remove('done');
    });

    const isDual = this.lanes.length > 1;
    this.actionLabelElement.textContent = isDual
      ? `${index + 1}/4 - ${step.action} [${this.getStepKeyLabel(step)}]`
      : `${index + 1}/4 - ${step.action}`;

    // Zera o visual de cada faixa e posiciona a zona verde inicial
    this.lanes.forEach((lane) => {
      const dom = lane.dom;
      dom.keyLabel.textContent = lane.spec.key;
      dom.keyBox.className = 'qte-key-box';
      dom.fill.style.width = '0%';
      dom.fill.className = 'meter-fill';
      dom.needle.style.left = '0%';
      dom.meterContainer.style.width = `${Math.round(step.baseWidth)}px`;
      this.paintSweetZone(lane, lane.spec.baseToleranceMs);
    });

    this.clearFeedback();
  }

  // Desenha a zona verde da faixa para uma dada tolerância
  paintSweetZone(lane, toleranceMs) {
    const target = lane.spec.targetHoldMs;
    const maxBarTime = target + toleranceMs * 2.2;
    const sweetStartMs = target - toleranceMs;
    const sweetEndMs = target + toleranceMs;

    lane.dom.sweetZone.style.left = `${(sweetStartMs / maxBarTime) * 100}%`;
    lane.dom.sweetZone.style.width = `${((sweetEndMs - sweetStartMs) / maxBarTime) * 100}%`;
  }

  matchesKey(e, spec) {
    return e.code === spec.code || e.key.toUpperCase() === spec.key;
  }

  handleKeyDown(e) {
    if (!this.isActive) return;
    if (e.repeat) return; // Ignora o autofire do sistema operacional ao segurar tecla

    const step = this.steps[this.currentStepIndex];
    if (!step) return;

    if (this.isSequenceStep(step)) {
      this.handleSequenceKey(e, step);
      return;
    }

    const lane = this.lanes.find((l) => this.matchesKey(e, l.spec));

    // Pressionou uma tecla que não faz parte deste golpe
    if (!lane) {
      const pressedKey = e.key.toUpperCase();
      this.triggerFail(
        'WRONG KEY!',
        `Pressed [${pressedKey}], but the strike required [${this.getStepKeyLabel(step)}]`
      );
      window.Sound.playWrongKey();
      return;
    }

    // Tecla já resolvida ou já sendo segurada: ignora o repique
    if (lane.done || lane.isHolding) return;

    const now = performance.now();

    if (this.firstPressTime === null) {
      this.firstPressTime = now;
    }

    // Cada tecla congela a tolerância que ela própria conquistou até este instante.
    // A outra faixa segue encolhendo até ser pressionada.
    lane.activeToleranceMs = lane.currentToleranceMs;

    // Tom de tensão: reinicia a cada tecla nova, inclusive quando elas são
    // resolvidas em sequência em vez de juntas
    if (!this.anyLaneHolding()) {
      window.Sound.startHoldTone(200 + this.currentStepIndex * 50);
    }

    lane.pressed = true;
    lane.isHolding = true;
    lane.holdStartTime = now;
    lane.dom.keyBox.classList.add('pressing');
  }

  // Cada tecla da sequência: acertou avança, errou mata na hora
  handleSequenceKey(e, step) {
    const pressedKey = e.key.toUpperCase();
    const expected = step.sequence[this.sequenceIndex];

    // Ignora teclas que não fazem parte do jogo (Shift, Tab, F5...)
    if (pressedKey.length !== 1 && !e.code.startsWith('Key')) return;

    const now = performance.now();

    if (pressedKey !== expected && e.code !== `Key${expected}`) {
      this.triggerFail(
        'SEQUENCE BROKEN!',
        `Key ${this.sequenceIndex + 1} of ${step.sequence.length}: expected [${expected}], got [${pressedKey}].`
      );
      window.Sound.playWrongKey();
      return;
    }

    // O relógio da sequência começa a correr na primeira tecla certa
    if (this.sequenceIndex === 0) {
      this.sequenceStartTime = now;
    }

    const el = this.sequenceKeyElements[this.sequenceIndex];
    if (el) {
      el.classList.remove('next');
      el.classList.add('done');
    }

    this.sequenceIndex++;
    window.Sound.playPerfect();

    if (this.onLaneSuccess) {
      this.onLaneSuccess(null);
    }

    // Ainda faltam teclas: marca a próxima e segue
    if (this.sequenceIndex < step.sequence.length) {
      const proxima = this.sequenceKeyElements[this.sequenceIndex];
      if (proxima) proxima.classList.add('next');
      return;
    }

    // Sequência completa
    const elapsed = Math.round(now - this.sequenceStartTime);
    this.results.push({
      key: `SEQ ${step.sequence.join('')}`,
      action: step.action,
      targetMs: step.sequenceTimeMs,
      actualMs: elapsed,
      deviationMs: Math.max(0, step.sequenceTimeMs - elapsed),
      rating: elapsed < step.sequenceTimeMs * 0.55 ? 'PERFECT' : 'GOOD'
    });

    this.triggerStepSuccess();
  }

  handleKeyUp(e) {
    if (!this.isActive) return;

    const step = this.steps[this.currentStepIndex];
    if (!step) return;
    if (this.isSequenceStep(step)) return;   // Sequência só olha o apertar

    const lane = this.lanes.find((l) => l.isHolding && this.matchesKey(e, l.spec));
    if (!lane) return;

    const now = performance.now();
    const holdDuration = now - lane.holdStartTime;

    lane.isHolding = false;
    lane.dom.keyBox.classList.remove('pressing');
    lane.dom.keyBox.classList.remove('in-sweet-zone');

    if (!this.anyLaneHolding()) {
      window.Sound.stopHoldTone();
    }

    const target = lane.spec.targetHoldMs;
    const minAllowed = target - lane.activeToleranceMs;
    const maxAllowed = target + lane.activeToleranceMs;

    if (holdDuration < minAllowed) {
      const diff = Math.round(minAllowed - holdDuration);
      this.triggerFail('TOO EARLY!', `Released [${lane.spec.key}] ${diff}ms before the ideal zone.`);
      window.Sound.playTooEarly();
      return;
    }

    if (holdDuration > maxAllowed) {
      const diff = Math.round(holdDuration - maxAllowed);
      this.triggerFail('TOO LATE!', `Held [${lane.spec.key}] ${diff}ms past the ideal zone.`);
      window.Sound.playTooLate();
      return;
    }

    // Tecla acertada
    this.completeLane(lane, holdDuration);
  }

  completeLane(lane, holdDuration) {
    const step = this.steps[this.currentStepIndex];
    const deviation = Math.round(Math.abs(holdDuration - lane.spec.targetHoldMs));

    lane.done = true;
    lane.dom.keyBox.classList.add('done');
    lane.dom.row.classList.add('done');

    this.results.push({
      key: lane.spec.key,
      action: step.action,
      targetMs: lane.spec.targetHoldMs,
      actualMs: Math.round(holdDuration),
      deviationMs: deviation,
      rating: deviation < 35 ? 'PERFECT' : 'GOOD'
    });

    // Ainda falta tecla neste golpe: marca o impacto e segue esperando a outra
    if (this.lanes.some((l) => !l.done)) {
      window.Sound.playPerfect();
      if (this.onLaneSuccess) {
        this.onLaneSuccess(lane);
      }
      return;
    }

    this.triggerStepSuccess();
  }

  update(now) {
    if (!this.isActive) return;

    const step = this.steps[this.currentStepIndex];
    if (!step) return;

    // GOLPE DE SEQUÊNCIA: só um relógio, sem barras
    if (this.isSequenceStep(step)) {
      if (this.sequenceIndex === 0) {
        // Ainda não começou: prazo curto só para reagir
        const espera = now - this.stepStartTime;
        this.paintSequenceTimer(step.sequenceTimeMs);
        if (espera > step.startGraceMs) {
          this.triggerFail('OUT OF TIME!', 'You froze and never started the final sequence.');
          window.Sound.playWrongKey();
        }
        return;
      }

      const restante = step.sequenceTimeMs - (now - this.sequenceStartTime);
      this.paintSequenceTimer(restante);

      if (restante <= 0) {
        this.triggerFail(
          'TOO SLOW!',
          `${step.sequence.length - this.sequenceIndex} keys of the final sequence were left unpressed.`
        );
        window.Sound.playTooLate();
      }
      return;
    }

    // FASE DE ESPERA, FAIXA A FAIXA: cada tecla que ainda não foi pressionada continua
    // encolhendo em tempo real, mesmo que a outra já esteja sendo segurada.
    const waitTime = now - this.stepStartTime;
    const remainingRatio = Math.max(0, 1 - (waitTime / step.maxWaitStartMs));

    this.lanes.forEach((lane) => {
      if (lane.pressed) return;   // Faixa já iniciada: largura e tolerância congeladas

      // 1. Redução dinâmica contínua do tamanho físico da barra
      lane.currentWidth = step.minWidth + (step.baseWidth - step.minWidth) * remainingRatio;
      lane.dom.meterContainer.style.width = `${Math.round(lane.currentWidth)}px`;

      // 2. Redução dinâmica contínua da zona de acerto desta tecla
      const spec = lane.spec;
      lane.currentToleranceMs = spec.minToleranceMs +
        (spec.baseToleranceMs - spec.minToleranceMs) * remainingRatio;
      this.paintSweetZone(lane, lane.currentToleranceMs);
    });

    // Nenhuma tecla ainda: o golpe inteiro tem prazo para começar
    if (this.firstPressTime === null) {
      if (waitTime > step.maxWaitStartMs) {
        this.triggerFail('OUT OF TIME!', 'You hesitated and failed to react to the enemy strike.');
        window.Sound.playWrongKey();
      }
      return;
    }

    // GOLPE DUPLO: a outra tecla pode entrar quando você quiser, junto ou depois,
    // mas não dá para deixar o golpe pendurado para sempre.
    if (this.lanes.length > 1) {
      const faltando = this.lanes.find((l) => !l.pressed);
      if (faltando && (now - this.firstPressTime) > step.secondKeyGraceMs) {
        this.triggerFail(
          'MISSING KEY!',
          `The strike required [${this.getStepKeyLabel(step)}] and key [${faltando.spec.key}] never came.`
        );
        window.Sound.playWrongKey();
        return;
      }
    }

    // FASE DE HOLD: atualiza cada faixa que está sendo segurada
    let maiorProgresso = 0;

    for (const lane of this.lanes) {
      if (!lane.isHolding) continue;

      const target = lane.spec.targetHoldMs;
      const holdDuration = now - lane.holdStartTime;
      const maxBarTime = target + lane.activeToleranceMs * 2.2;
      const fillPercent = Math.min(100, (holdDuration / maxBarTime) * 100);

      lane.dom.fill.style.width = `${fillPercent}%`;
      lane.dom.needle.style.left = `${fillPercent}%`;

      const minAllowed = target - lane.activeToleranceMs;
      const maxAllowed = target + lane.activeToleranceMs;

      maiorProgresso = Math.max(maiorProgresso, holdDuration / target);

      // Feedback visual se está dentro da zona verde neste momento
      if (holdDuration >= minAllowed && holdDuration <= maxAllowed) {
        lane.dom.keyBox.classList.add('in-sweet-zone');
      } else {
        lane.dom.keyBox.classList.remove('in-sweet-zone');
      }

      // Se ultrapassou o limite superior sem soltar (Overheat)
      if (holdDuration > maxAllowed) {
        lane.dom.keyBox.classList.add('overheated');
        lane.dom.fill.classList.add('overheat');
        lane.isHolding = false;
        window.Sound.stopHoldTone();

        const diff = Math.round(holdDuration - maxAllowed);
        this.triggerFail(
          'TOO LATE / OVERLOAD!',
          `Held [${lane.spec.key}] too long without releasing (+${diff}ms).`
        );
        window.Sound.playTooLate();
        return;
      }
    }

    // Atualiza o pitch do áudio pela faixa mais adiantada
    if (maiorProgresso > 0) {
      window.Sound.updateHoldTonePitch(maiorProgresso);
    }
  }

  triggerStepSuccess() {
    const currentStep = this.steps[this.currentStepIndex];

    // Atualiza Dot de status
    const dot = document.getElementById(`step-dot-${this.currentStepIndex}`);
    if (dot) {
      dot.classList.remove('active');
      dot.classList.add('completed');
    }

    window.Sound.playPerfect();

    // Oculta imediatamente a interface para deixar a tela 100% limpa durante a animação
    this.hudElement.classList.add('hidden');

    this.isActive = false;
    if (this.onStepSuccess) {
      this.onStepSuccess(this.currentStepIndex, currentStep);
    }

    if (this.currentStepIndex + 1 >= this.steps.length) {
      this.finishSuccess();
    }
  }

  triggerFail(reason, details) {
    this.isActive = false;
    this.releaseAllLanes();
    window.Sound.stopHoldTone();

    const dot = document.getElementById(`step-dot-${this.currentStepIndex}`);
    if (dot) {
      dot.classList.remove('active');
      dot.classList.add('failed');
    }

    this.showFeedback(reason, 'wrong');

    if (this.onFail) {
      this.onFail(this.currentStepIndex, reason, details);
    }
  }

  finishSuccess() {
    this.isActive = false;
    this.hudElement.classList.add('hidden');
    if (this.onComplete) {
      this.onComplete(this.results);
    }
  }

  showFeedback(text, type) {
    this.feedbackElement.textContent = text;
    this.feedbackElement.className = `feedback-text ${type}`;
  }

  clearFeedback() {
    this.feedbackElement.textContent = '';
    this.feedbackElement.className = 'feedback-text';
  }
}

window.QTEManager = QTEManager;
