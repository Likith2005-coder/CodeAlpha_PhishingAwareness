/* ═══════════════════════════════════════════════════════════════════
   Spot the Phish — interaction layer

   Three independent widgets, no dependencies:
     1. Evidence markup  — mark red flags on the sample email
     2. URL dissector    — break an address into parts, name the real domain
     3. Quiz             — eight scored questions with explanations
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  /* ─── 1. Evidence markup ─────────────────────────────────────── */

  const evidence = Array.from(document.querySelectorAll(".ev"));
  const notes = Array.from(document.querySelectorAll(".note"));
  const revealBtn = document.getElementById("revealBtn");
  const revealLabel = document.getElementById("revealLabel");
  const foundCount = document.getElementById("foundCount");
  const notesHint = document.getElementById("notesHint");

  const marked = new Set();

  function noteFor(flag) {
    return notes.find((n) => n.dataset.note === flag);
  }

  const HINT_IDLE =
    "Select any highlighted fragment in the message, or press Mark the red flags to reveal all six.";
  const HINT_DONE =
    "All six marked. In a real inbox any one of these is reason enough to stop.";

  /**
   * Keeps the counter, hint and button label in step with the actual state.
   * The button has to be derived rather than toggled, because the user can
   * also reach "all marked" by clicking the six fragments one at a time.
   */
  function updateCount() {
    const all = marked.size === evidence.length;
    foundCount.textContent = String(marked.size);
    notesHint.textContent = all ? HINT_DONE : HINT_IDLE;
    revealBtn.setAttribute("aria-pressed", String(all));
    revealLabel.textContent = all ? "Clear the markings" : "Mark the red flags";
  }

  function select(flag) {
    evidence.forEach((e) => e.classList.toggle("is-active", e.dataset.flag === flag));
    notes.forEach((n) => n.classList.toggle("is-active", n.dataset.note === flag));
    const note = noteFor(flag);
    if (note) note.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function mark(flag) {
    marked.add(flag);
    const el = evidence.find((e) => e.dataset.flag === flag);
    const note = noteFor(flag);
    if (el) el.classList.add("is-marked");
    if (note) note.classList.add("is-shown");
    updateCount();
  }

  evidence.forEach((el) => {
    el.addEventListener("click", () => {
      mark(el.dataset.flag);
      select(el.dataset.flag);
    });
  });

  notes.forEach((note) => {
    note.addEventListener("click", () => {
      if (!note.classList.contains("is-shown")) return;
      select(note.dataset.note);
      const el = evidence.find((e) => e.dataset.flag === note.dataset.note);
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  });

  revealBtn.addEventListener("click", () => {
    if (marked.size === evidence.length) {
      // Reset, so the exercise can be run again or shown to someone else
      marked.clear();
      evidence.forEach((e) => e.classList.remove("is-marked", "is-active"));
      notes.forEach((n) => n.classList.remove("is-shown", "is-active"));
    } else {
      evidence.forEach((e) => e.dataset.flag && mark(e.dataset.flag));
    }
    updateCount();
  });

  updateCount();

  /* ─── 2. URL dissector ───────────────────────────────────────── */

  /**
   * Each specimen is split into labelled segments. `role` drives the styling:
   * only the registrable domain is highlighted, because that is the only part
   * of an address that identifies who you are actually talking to.
   */
  const SPECIMENS = [
    {
      tab: "Subdomain trick",
      safe: false,
      segments: [
        { t: "https://", role: "dim" },
        { t: "microsoft-account.com.", role: "sub", tip: "subdomain — free text" },
        { t: "session-verify.ru", role: "domain", tip: "the real owner" },
        { t: "/login", role: "path" },
      ],
      verdict: "Not Microsoft",
      note:
        "Everything before the registrable domain is chosen by whoever owns the site. Here the owner registered <code>session-verify.ru</code> and simply typed <code>microsoft-account.com</code> in front of it as a subdomain. Reading left to right, your eye stops at a familiar name before it ever reaches the part that matters.",
    },
    {
      tab: "Lookalike letters",
      safe: false,
      segments: [
        { t: "https://", role: "dim" },
        { t: "www.", role: "sub", tip: "subdomain" },
        { t: "rnicrosoft.com", role: "domain", tip: "r + n, not m" },
        { t: "/verify", role: "path" },
      ],
      verdict: "Homoglyph",
      note:
        "<code>rn</code> renders almost identically to <code>m</code> at normal text size, and this works just as well with <code>l</code> and <code>I</code>, or <code>0</code> and <code>O</code>. Widen the text or read the domain one character at a time when anything else looks off.",
    },
    {
      tab: "Different alphabet",
      safe: false,
      segments: [
        { t: "https://", role: "dim" },
        { t: "аpple.com", role: "domain", tip: "Cyrillic а" },
        { t: "/id/signin", role: "path" },
      ],
      verdict: "Punycode",
      note:
        "The first character is Cyrillic <b>а</b> (U+0430), not Latin <b>a</b>. The two are visually identical in most fonts. Your browser stores this as <code>xn--pple-43d.com</code> — if an address bar ever shows an <code>xn--</code> prefix, the site is using characters from another alphabet.",
    },
    {
      tab: "Wrong ending",
      safe: false,
      segments: [
        { t: "https://", role: "dim" },
        { t: "secure.", role: "sub", tip: "subdomain" },
        { t: "sbi-online.co", role: "domain", tip: ".co, not .co.in" },
        { t: "/netbanking", role: "path" },
      ],
      verdict: "Wrong domain",
      note:
        "A familiar name with an unfamiliar ending is a different organisation entirely. <code>.co</code> is Colombia's national domain and is widely used because it looks like a truncated <code>.com</code>. Indian banks use <code>.co.in</code> or <code>.in</code>.",
    },
    {
      tab: "The genuine one",
      safe: true,
      segments: [
        { t: "https://", role: "dim" },
        { t: "login.", role: "sub", tip: "subdomain" },
        { t: "microsoft.com", role: "domain", tip: "the real owner" },
        { t: "/oauth2/authorize", role: "path" },
      ],
      verdict: "Genuine",
      note:
        "The registrable domain is <code>microsoft.com</code>, so this really is Microsoft, whatever appears to the left of it. Subdomains like <code>login.</code> are controlled by the domain's owner — which is exactly why the domain, and not the subdomain, is the part you check.",
    },
  ];

  const picker = document.querySelector(".dissect__picker");
  const urlOut = document.getElementById("dissectUrl");
  const verdictOut = document.getElementById("dissectVerdict");
  const noteOut = document.getElementById("dissectNote");

  function renderSpecimen(i) {
    const s = SPECIMENS[i];

    urlOut.innerHTML = "";
    s.segments.forEach((seg) => {
      const span = document.createElement("span");
      span.className = "seg seg--" + seg.role;
      span.textContent = seg.t;
      if (seg.tip) {
        const tip = document.createElement("span");
        tip.className = "seg__tip";
        tip.textContent = seg.tip;
        span.appendChild(tip);
      }
      urlOut.appendChild(span);
    });

    verdictOut.textContent = s.verdict;
    verdictOut.className = "dissect__verdict " + (s.safe ? "is-good" : "is-bad");
    noteOut.innerHTML = s.note;

    Array.from(picker.children).forEach((b, bi) =>
      b.setAttribute("aria-selected", String(bi === i)),
    );
  }

  SPECIMENS.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dissect__tab";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", "false");
    b.textContent = s.tab;
    b.addEventListener("click", () => renderSpecimen(i));
    picker.appendChild(b);
  });
  renderSpecimen(0);

  /* ─── 3. Quiz ────────────────────────────────────────────────── */

  const QUESTIONS = [
    {
      q: "Which of these addresses actually belongs to your bank?",
      scenario:
        "You bank with HDFC. A message asks you to log in and links to one of these.",
      options: [
        "hdfcbank.com.secure-login.net",
        "netbanking.hdfcbank.com",
        "hdfcbank-netbanking.com",
        "secure-hdfcbank.co",
      ],
      answer: 1,
      why: "Read right to left from the last slash. Only <code>netbanking.hdfcbank.com</code> has <code>hdfcbank.com</code> as its registrable domain — <code>netbanking.</code> is a subdomain the bank controls. The others are owned by <code>secure-login.net</code>, <code>hdfcbank-netbanking.com</code> and <code>secure-hdfcbank.co</code> respectively: three different organisations, none of them your bank.",
    },
    {
      q: "The email has a padlock in the browser and a valid certificate. What does that prove?",
      scenario: "",
      options: [
        "The site is operated by the company it appears to be",
        "The site has been checked and approved",
        "Traffic between you and the site is encrypted — nothing more",
        "The site cannot host malware",
      ],
      answer: 2,
      why: "HTTPS protects data <b>in transit</b>. Certificates are free and issued within minutes, so the large majority of phishing sites now have one. The padlock means nobody can read your password on the way — it says nothing about who receives it at the other end.",
    },
    {
      q: "Your CEO emails asking you to buy gift cards for a client, urgently, and to keep it quiet until the announcement. What do you do?",
      scenario:
        "From: Rajesh Kumar (CEO) <b>&lt;rajesh.kumar.ceo@gmail.com&gt;</b><br>“In a board meeting, can't take calls. Need this in the next 30 minutes.”",
      options: [
        "Buy them — it's the CEO and it's urgent",
        "Reply to the email asking him to confirm",
        "Call him on the number you already have, or check with finance",
        "Forward it to a colleague to handle",
      ],
      answer: 2,
      why: "Every element here is a lever: authority, urgency, secrecy, and an untraceable payment method. Replying only reaches the attacker, since the reply goes to their address. Verify on a channel you already trust — a number you had before the message arrived. Gift-card requests from executives are almost never genuine.",
    },
    {
      q: "Which greeting is the stronger warning sign?",
      scenario: "",
      options: [
        "“Dear Valued Customer,”",
        "“Hi Likith,”",
        "Both are equally suspicious",
        "Neither tells you anything useful",
      ],
      answer: 0,
      why: "Your provider knows your name and normally uses it, so a generic greeting suggests a bulk mailing. But treat this as one signal among several: a spear-phishing email aimed at you specifically <i>will</i> use your real name, often with your job title and manager, taken from LinkedIn or a past breach. A correct name is not evidence of legitimacy.",
    },
    {
      q: "An SMS says your parcel could not be delivered and asks for a small redelivery fee.",
      scenario:
        "<b>+91 91XXXXXX02</b><br>“Your package is on hold. Pay ₹25 redelivery: bit.ly/in-parcl-redel”",
      options: [
        "Pay it — the amount is trivial",
        "Open the link to check whether the parcel is real",
        "Ignore it and track the parcel in the courier's own app or website",
        "Reply STOP",
      ],
      answer: 2,
      why: "The tiny amount is the point: it is small enough that you stop weighing it, and the goal is your card details rather than the ₹25. Shortened links hide the destination completely. If you are genuinely expecting a parcel, open the courier's own app — never a link that arrived by message.",
    },
    {
      q: "You entered your password on a site that turned out to be fake. What is the first thing to do?",
      scenario: "",
      options: [
        "Wait and watch for unusual activity",
        "Change that password immediately from a trusted device, and anywhere you reused it",
        "Run an antivirus scan",
        "Delete the email"
      ],
      answer: 1,
      why: "Credentials are used within minutes, often automatically. Change the password first, then sign out all active sessions and check for attacker persistence — added recovery emails, forwarding rules, app passwords. Then report it. Deleting the email destroys evidence your security team needs, and waiting only donates time.",
    },
    {
      q: "A colleague's real account emails you a document link. The account is genuine, not spoofed. Is it safe?",
      scenario: "",
      options: [
        "Yes — the account is verified as really theirs",
        "Not necessarily; their account may be compromised",
        "Only if the attachment is a PDF",
        "Only if you have emailed them before",
      ],
      answer: 1,
      why: "This is business email compromise, and it defeats sender checks entirely because the sender <i>is</i> real. Attackers use a compromised mailbox to reach that person's contacts, often replying inside a genuine existing thread. Judge the request, not just the sender: is this something they would send, and were you expecting it?",
    },
    {
      q: "Which single measure does most to protect you when a password is stolen?",
      scenario: "",
      options: [
        "Changing your password every 30 days",
        "A longer, more complex password",
        "Multi-factor authentication, ideally an app or hardware key",
        "Antivirus software",
      ],
      answer: 2,
      why: "MFA breaks the attack: the stolen password alone stops being enough. Prefer an authenticator app or hardware key over SMS, since SIM swapping and real-time relay pages can defeat codes sent by text. Forced 30-day rotation is no longer recommended — it pushes people toward predictable variations.",
    },
  ];

  const KEYS = ["A", "B", "C", "D"];

  const qNum = document.getElementById("qNum");
  const qTotal = document.getElementById("qTotal");
  const qScore = document.getElementById("qScore");
  const qText = document.getElementById("qText");
  const qScenario = document.getElementById("qScenario");
  const qOptions = document.getElementById("qOptions");
  const qFeedback = document.getElementById("qFeedback");
  const qNext = document.getElementById("qNext");
  const qRestart = document.getElementById("qRestart");
  const qProgress = document.getElementById("quizProgress");
  const qResult = document.getElementById("qResult");
  const quizStage = document.querySelector(".quiz__stage");
  const qFinal = document.getElementById("qFinal");
  const qBand = document.getElementById("qBand");
  const qAdvice = document.getElementById("qAdvice");
  const qAgain = document.getElementById("qAgain");

  let index = 0;
  let score = 0;
  let answered = false;

  qTotal.textContent = String(QUESTIONS.length);

  function renderQuestion() {
    const item = QUESTIONS[index];
    answered = false;

    qNum.textContent = String(index + 1);
    qScore.textContent = String(score);
    qText.textContent = item.q;
    qScenario.innerHTML = item.scenario || "";
    qFeedback.className = "quiz__feedback";
    qFeedback.innerHTML = "";
    qNext.hidden = true;
    qRestart.hidden = index === 0;
    qProgress.style.width = (index / QUESTIONS.length) * 100 + "%";

    qOptions.innerHTML = "";
    item.options.forEach((text, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "opt";

      const key = document.createElement("span");
      key.className = "opt__key";
      key.textContent = KEYS[i];

      const label = document.createElement("span");
      label.textContent = text;

      b.append(key, label);
      b.addEventListener("click", () => choose(i));
      qOptions.appendChild(b);
    });
  }

  function choose(picked) {
    if (answered) return;
    answered = true;

    const item = QUESTIONS[index];
    const correct = picked === item.answer;
    if (correct) score++;

    Array.from(qOptions.children).forEach((b, i) => {
      b.disabled = true;
      if (i === item.answer) b.classList.add("is-correct");
      else if (i === picked) b.classList.add("is-wrong");
    });

    qScore.textContent = String(score);
    qFeedback.className = "quiz__feedback is-on " + (correct ? "is-right" : "is-wrong");
    qFeedback.innerHTML =
      "<b>" + (correct ? "Correct. " : "Not quite. ") + "</b>" + item.why;

    qNext.hidden = false;
    qNext.textContent =
      index === QUESTIONS.length - 1 ? "See your result" : "Next question";
    qNext.focus();
  }

  function finish() {
    quizStage.hidden = true;
    qResult.hidden = false;
    qProgress.style.width = "100%";
    qFinal.textContent = String(score);

    let band, advice;
    if (score === QUESTIONS.length) {
      band = "You would be hard to phish";
      advice =
        "You are checking the domain, not the display name, and you are judging the request rather than the sender. Keep the habit of verifying money and credentials on a second channel.";
    } else if (score >= 6) {
      band = "Solid instincts, a few gaps";
      advice =
        "You catch the obvious attempts. The ones that would get you are the quiet kind — a real colleague's compromised account, or a request that arrives exactly when you were expecting one. Re-read the explanations you missed.";
    } else if (score >= 4) {
      band = "Worth another pass";
      advice =
        "You are spotting some signals but not yet checking the address itself. Work through the URL dissector above until reading a domain right to left feels automatic — that single habit defeats most of these attacks.";
    } else {
      band = "Start with the two habits that matter most";
      advice =
        "Turn on multi-factor authentication today, and never follow a link to log in — navigate to the site yourself instead. Those two alone would have stopped almost every attack on this page. Then take the module again.";
    }
    qBand.textContent = band;
    qAdvice.textContent = advice;
  }

  function restart() {
    index = 0;
    score = 0;
    quizStage.hidden = false;
    qResult.hidden = true;
    renderQuestion();
    document.getElementById("quiz").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  qNext.addEventListener("click", () => {
    if (index === QUESTIONS.length - 1) finish();
    else { index++; renderQuestion(); }
  });
  qRestart.addEventListener("click", restart);
  qAgain.addEventListener("click", restart);

  renderQuestion();

  /* ─── Scroll progress ────────────────────────────────────────── */

  const progress = document.getElementById("scrollProgress");
  let ticking = false;

  function updateProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    progress.style.width = pct + "%";
    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateProgress);
    }
  }, { passive: true });

  updateProgress();
})();
