// nda_app.js — NDA & Agreement Generator UI Controller

document.addEventListener('DOMContentLoaded', () => {
  let activeTab = 'doctype';

  const TABS_BASE  = ['doctype', 'party', 'engagement'];
  const TABS_SA    = ['doctype', 'party', 'engagement', 'schedule'];

  // ── Element refs ────────────────────────────────────────────────────────────
  const tabItems           = document.querySelectorAll('.step-item');
  const formTabs           = document.querySelectorAll('.form-tab');
  const prevBtn            = document.getElementById('prevBtn');
  const nextBtn            = document.getElementById('nextBtn');
  const generateBtn        = document.getElementById('generateBtn');
  const ndaForm            = document.getElementById('ndaForm');
  const loadingModal       = document.getElementById('loadingModal');
  const successModal       = document.getElementById('successModal');
  const errorModal         = document.getElementById('errorModal');
  const errorList          = document.getElementById('errorList');
  const signerEmailDisplay = document.getElementById('signerEmailDisplay');
  const closeSuccessBtn    = document.getElementById('closeSuccessBtn');
  const closeErrorBtn      = document.getElementById('closeErrorBtn');
  const scheduleStep       = document.getElementById('scheduleStep');
  const docTypeInfoPanel   = document.getElementById('docTypeInfoPanel');
  const partyContextBlurb  = document.getElementById('partyContextBlurb');
  const engagementContextBlurb = document.getElementById('engagementContextBlurb');

  // Doc-type conditional elements
  const ndaPartyFields          = document.getElementById('ndaPartyFields');
  const saPartyFields           = document.getElementById('saPartyFields');
  const circumventionGroup      = document.getElementById('circumventionConceptGroup');
  const commencementGroup       = document.getElementById('commencementGroup');
  const partyTabTitle           = document.getElementById('partyTabTitle');
  const partyTabDesc            = document.getElementById('partyTabDesc');
  const sidebarPartyLabel       = document.getElementById('sidebarPartyLabel');
  const conflictDetailsGroup    = document.getElementById('conflictDetailsGroup');

  // ── Info panel content per document type ──────────────────────────────────────
  const INFO_PANEL = {
    nda_standard: `
      <div class="info-panel-title">🤝 When to use the Standard NDA</div>
      <div class="info-panel-body">
        <p>Use this <strong>before any substantive discussion</strong> where sensitive information will flow between DistCap and another party — whether you're talking to a prospective client, a co-advisor, a capital partner, a fund manager, or a government counterpart.</p>
        <p>Both parties are simultaneously bound as <strong>Discloser and Recipient</strong> — meaning DistCap is also bound not to misuse what it receives. This makes it appropriate when both sides will be sharing sensitive information (deal models, client identities, strategy, financials).</p>
        <p><strong>Key terms:</strong></p>
        <ul>
          <li>Confidentiality obligation <strong>survives 2 years</strong> after the relationship ends, whether or not a deal proceeds</li>
          <li>Covers both structured data and oral briefings documented within 5 days</li>
          <li>Neither party is obligated to share any particular information or to continue discussions</li>
          <li>Exclusions: information already public, independently developed, or lawfully received from a third party</li>
        </ul>
        <div class="info-tags">
          <span class="info-tag">Mutual obligation</span>
          <span class="info-tag">Prospective clients</span>
          <span class="info-tag">Co-advisors &amp; JV partners</span>
          <span class="info-tag">Investors &amp; capital sources</span>
          <span class="info-tag">Government &amp; institutions</span>
        </div>
      </div>`,

    nda_circumvention: `
      <div class="info-panel-title">🔒 When to use NDA + Non-Circumvention</div>
      <div class="info-panel-body">
        <p>Use this when Phil has <strong>originated a specific deal concept</strong> — a transaction structure, development play, or commercial model — and needs to share it with someone who could theoretically bypass DistCap to act on it independently.</p>
        <p>The standard NDA protects <em>information</em>. The non-circumvention clause also restricts the counterparty from <strong>acting on the concept</strong> — approaching the asset owner, executing the strategy, or engaging other advisers to pursue the same deal structure — without Phil's involvement and consent. It protects the concept itself, not just the information about it.</p>
        <p><strong>Classic scenario:</strong> Phil originates a train station air rights play — identifies the opportunity, develops the structure, models the economics. He needs to bring in an external party to help advance it. This agreement prevents that party from going directly to Sydney Trains and cutting Phil out.</p>
        <p><strong>Key terms (beyond the standard NDA):</strong></p>
        <ul>
          <li>Non-circumvention period: <strong>2 years</strong> from the date of the agreement</li>
          <li>The concept name you enter below appears verbatim in the clause — be precise</li>
          <li>Applies to the specific deal concept, not to DistCap's general advisory business</li>
        </ul>
        <div class="info-tags">
          <span class="info-tag">Phil-originated deal concepts</span>
          <span class="info-tag">Transaction structuring</span>
          <span class="info-tag">Development plays</span>
          <span class="info-tag">Proprietary commercial models</span>
        </div>
      </div>`,

    service_agreement: `
      <div class="info-panel-title">📋 When to use the Service Agreement</div>
      <div class="info-panel-body">
        <p>Use this to <strong>engage an external consultant or specialist</strong> who will work under DistCap on a live client mandate. In this document, <strong>DistCap is the Client</strong> — the consultant is the Consultancy being engaged and paid by DistCap.</p>
        <p>This is the document for property analysts, transaction managers, financial modellers, sector experts, or any other external professional whose skills DistCap draws on for client work but who aren't DistCap employees.</p>
        <p><strong>Key terms you should be aware of:</strong></p>
        <ul>
          <li><strong>Independent contractor status</strong> — the consultant is explicitly not an employee. They pay their own tax, super, and insurance.</li>
          <li><strong>IP transfer</strong> — all work product belongs to DistCap on payment. The consultant retains no copyright in deliverables.</li>
          <li><strong>Pay-when-paid mechanism</strong> — for client-funded work, DistCap only pays the consultant once it receives cleared funds from its own client. DistCap must pursue its client within 60 days of overdue payment.</li>
          <li><strong>Non-solicitation (2 years)</strong> — after the agreement ends, the consultant cannot approach DistCap's clients (those they served directly) without written consent.</li>
          <li><strong>Liability cap</strong> — consultant's liability is capped at the higher of: their insurance limit or total fees paid under the relevant Schedule 1.</li>
        </ul>
        <p>Schedule 1 (Step D) is the project-specific attachment. The main terms stay permanent; Schedule 1 is re-filled per engagement. Multiple Schedule 1s can run concurrently under one Service Agreement — you don't need a new agreement per project.</p>
        <div class="info-tags">
          <span class="info-tag">External consultants</span>
          <span class="info-tag">Property analysts</span>
          <span class="info-tag">Transaction specialists</span>
          <span class="info-tag">Financial modellers</span>
          <span class="info-tag">Sub-contracted advisors</span>
        </div>
      </div>`
  };

  // ── Party tab context blurbs ─────────────────────────────────────────────────
  const PARTY_CONTEXT = {
    nda_standard: `<strong>Who goes here?</strong> The counterparty is the organisation or individual you're about to enter into a mutual NDA with. Both parties sign as Discloser and Recipient simultaneously. Enter their details exactly as they should appear in the formal agreement — full legal name (including Pty Ltd / Ltd), ABN, and their legal registered address. If you're unsure of their precise legal name, check ASIC Connect (search by ABN or company name) before proceeding.`,

    nda_circumvention: `<strong>Who goes here?</strong> The counterparty is the person or entity you're sharing Phil's deal concept with under the NDA + Non-Circumvention agreement. This is typically someone Phil needs to bring into a specific deal — a co-investor, a specialist adviser, or a development partner. Both parties are bound as Discloser and Recipient, and both are also bound by the non-circumvention obligation. Enter their full legal entity details exactly as they should appear on the signature page.`,

    service_agreement: `<strong>Who goes here?</strong> The Consultancy is the external contractor being engaged. They must have their own legal entity and ABN to be engaged as an independent contractor — this is a legal requirement, not just administrative preference. If they're operating as a sole trader, use their trading name and ABN. If they're a Pty Ltd, use the company name and ACN. Verify the ABN is active before you proceed — inactive ABNs create withholding tax obligations. DistCap is the Client in this agreement; the Consultancy is the party being paid to deliver services.`
  };

  // ── Engagement tab context blurbs ────────────────────────────────────────────
  const ENGAGEMENT_CONTEXT = {
    nda_standard: `<strong>Agreement Date:</strong> The date both parties sign — this starts the 2-year confidentiality clock. In practice, use today's date. If discussions have been ongoing and you're formalising a retroactive NDA, you can backdate to when confidential information was first shared — but check with Phil before backdating, as it changes when the 2-year period expires.`,

    nda_circumvention: `<strong>Agreement Date:</strong> The date both parties sign — this starts both the 2-year confidentiality period and the 2-year non-circumvention period simultaneously. The Transaction Concept Name entered on Step A must be settled before signing — it appears verbatim in the non-circumvention clause and defines precisely what deal concept the counterparty is prohibited from acting on independently. If the concept isn't clearly articulated, the clause may be difficult to enforce.`,

    service_agreement: `<strong>Agreement Date</strong> is when both parties sign. <strong>Commencement Date</strong> is when the consultant actually starts delivering services — these can differ. E.g. the agreement might be signed on 1 July but work begins 7 July. The agreement has no fixed end date; either party can terminate by giving 4 weeks' written notice. A separate 12-week notice period applies if either party intends to wind up operations entirely. Individual project durations are managed through Schedule 1 (next step).`
  };

  // ── Doc-type helpers ─────────────────────────────────────────────────────────
  function getDocType() {
    const radio = document.querySelector('input[name="doc_type"]:checked');
    return radio ? radio.value : 'nda_standard';
  }

  function getTabsOrder() {
    return getDocType() === 'service_agreement' ? TABS_SA : TABS_BASE;
  }

  function applyDocType(docType) {
    const isSA   = docType === 'service_agreement';
    const isCirc = docType === 'nda_circumvention';

    // ── Dynamic info panel ────────────────────────────────────────────────────
    if (docTypeInfoPanel) {
      docTypeInfoPanel.innerHTML = INFO_PANEL[docType] || INFO_PANEL.nda_standard;
    }

    // ── Party tab context blurb ───────────────────────────────────────────────
    if (partyContextBlurb) {
      partyContextBlurb.innerHTML = PARTY_CONTEXT[docType] || PARTY_CONTEXT.nda_standard;
    }

    // ── Engagement tab context blurb ──────────────────────────────────────────
    if (engagementContextBlurb) {
      engagementContextBlurb.innerHTML = ENGAGEMENT_CONTEXT[docType] || ENGAGEMENT_CONTEXT.nda_standard;
    }

    // ── Party tab labels ──────────────────────────────────────────────────────
    if (isSA) {
      partyTabTitle.textContent     = 'Consultancy Details';
      partyTabDesc.textContent      = 'Enter the consultant or contractor being engaged by Distillery Capital.';
      sidebarPartyLabel.textContent = 'Consultancy Details';
      ndaPartyFields.style.display  = 'none';
      saPartyFields.style.display   = '';
    } else {
      partyTabTitle.textContent     = 'Counterparty Details';
      partyTabDesc.textContent      = 'Enter details about the other party to the NDA.';
      sidebarPartyLabel.textContent = 'Counterparty Details';
      ndaPartyFields.style.display  = '';
      saPartyFields.style.display   = 'none';
    }

    // ── Conditional fields ────────────────────────────────────────────────────
    circumventionGroup.style.display = isCirc ? '' : 'none';
    commencementGroup.style.display  = isSA  ? '' : 'none';
    scheduleStep.style.display       = isSA  ? '' : 'none';
  }

  document.querySelectorAll('input[name="doc_type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      applyDocType(radio.value);
      if (radio.value !== 'service_agreement' && activeTab === 'schedule') {
        switchTab('engagement');
      }
      updateNavButtons();
    });
  });

  // ── Conflict of interest toggle ──────────────────────────────────────────────
  document.querySelectorAll('input[name="SCHEDULE_CONFLICT"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      conflictDetailsGroup.style.display = e.target.value === 'is' ? '' : 'none';
    });
  });

  // ── Tab navigation ───────────────────────────────────────────────────────────
  function switchTab(tabId) {
    activeTab = tabId;
    tabItems.forEach(item => item.classList.toggle('active', item.dataset.tab === tabId));
    formTabs.forEach(tab => tab.classList.toggle('active', tab.id === `tab-${tabId}`));
    updateNavButtons();
    // Scroll form container back to top on tab change
    const formContainer = document.querySelector('.form-container');
    if (formContainer) formContainer.scrollTop = 0;
  }

  function updateNavButtons() {
    const order = getTabsOrder();
    const idx   = order.indexOf(activeTab);
    const last  = idx === order.length - 1;
    prevBtn.disabled          = idx === 0;
    nextBtn.textContent       = last ? 'Review' : 'Next Step →';
    nextBtn.style.display     = last ? 'none' : '';
    generateBtn.style.display = last ? '' : 'none';
  }

  tabItems.forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });

  prevBtn.addEventListener('click', () => {
    const order = getTabsOrder();
    const idx   = order.indexOf(activeTab);
    if (idx > 0) switchTab(order[idx - 1]);
  });

  nextBtn.addEventListener('click', () => {
    const order = getTabsOrder();
    const idx   = order.indexOf(activeTab);
    if (idx < order.length - 1) {
      switchTab(order[idx + 1]);
    } else {
      generateDocument();
    }
  });

  generateBtn.addEventListener('click', generateDocument);

  // ── Pre-fill today's date ────────────────────────────────────────────────────
  const today   = new Date();
  const dateStr = today.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const yearStr = String(today.getFullYear());
  document.getElementById('DATE_ISSUE').value = dateStr;
  document.getElementById('YEAR').value        = yearStr;

  // ── Mode selector hint ───────────────────────────────────────────────────────
  const MODE_HINTS = {
    new:      'Fill in all fields below — a new engagement will be created.',
    amend:    'Fill in fields as amended — a new version will be generated and resubmitted.',
    annotate: 'Only notes will be saved — no new document will be generated or sent.'
  };
  const modeHint = document.getElementById('modeHint');
  document.querySelectorAll('input[name="form_mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (modeHint) modeHint.textContent = MODE_HINTS[radio.value] || '';
      generateBtn.textContent = radio.value === 'annotate'
        ? 'Save Notes'
        : 'Queue & Send for Signature';
    });
  });
  if (modeHint) modeHint.textContent = MODE_HINTS['new'];

  // ── Collect form payload ─────────────────────────────────────────────────────
  function getPayload() {
    const data = {};

    ndaForm.querySelectorAll('input[type="text"], input[type="email"], textarea').forEach(el => {
      if (el.name) data[el.name] = el.value.trim();
    });

    const docTypeRadio  = document.querySelector('input[name="doc_type"]:checked');
    data.doc_type       = docTypeRadio ? docTypeRadio.value : 'nda_standard';

    const conflictRadio       = document.querySelector('input[name="SCHEDULE_CONFLICT"]:checked');
    data.SCHEDULE_CONFLICT    = conflictRadio ? conflictRadio.value : 'is not';

    const modeRadio = document.querySelector('input[name="form_mode"]:checked');
    data.form_mode  = modeRadio ? modeRadio.value : 'new';

    // Normalise signer fields — SA uses SA_SIGNER_* fields
    const isSA = data.doc_type === 'service_agreement';
    data.SIGNER_NAME  = isSA ? (data.SA_SIGNER_NAME  || data.CONSULTANCY_SHORT_NAME || '') : (data.SIGNER_NAME  || '');
    data.SIGNER_EMAIL = isSA ? (data.SA_SIGNER_EMAIL || data.CONSULTANCY_EMAIL      || '') : (data.SIGNER_EMAIL || '');

    return data;
  }

  // ── Validation ───────────────────────────────────────────────────────────────
  function validate(data) {
    const errors  = [];
    const docType = data.doc_type;
    const isSA    = docType === 'service_agreement';
    const isCirc  = docType === 'nda_circumvention';

    if (!data.DATE_ISSUE) errors.push('Agreement Date is required (Step C).');

    if (data.form_mode !== 'annotate') {
      if (isSA) {
        if (!data.CONSULTANCY_LEGAL_ENTITY) errors.push('Consultancy Legal Entity Name is required (Step B).');
        if (!data.CONSULTANCY_ABN)          errors.push('Consultancy ABN is required (Step B).');
        if (!data.CONSULTANCY_ADDRESS)      errors.push('Consultancy Address is required (Step B).');
        if (!data.CONSULTANCY_EMAIL)        errors.push('Consultancy Email is required (Step B).');
        if (!data.SA_SIGNER_NAME)           errors.push('Signing Person\'s Name is required (Step B).');
        if (!data.SA_SIGNER_EMAIL)          errors.push('Signer\'s Email is required (Step B).');
        if (!data.COMMENCEMENT_DATE)        errors.push('Commencement Date is required (Step C).');
      } else {
        if (!data.COUNTERPARTY_LEGAL_ENTITY) errors.push('Counterparty Legal Entity Name is required (Step B).');
        if (!data.COUNTERPARTY_SHORT_NAME)   errors.push('Counterparty Short Name is required (Step B).');
        if (!data.COUNTERPARTY_ADDRESS)      errors.push('Counterparty Address is required (Step B).');
        if (!data.COUNTERPARTY_EMAIL)        errors.push('Counterparty Email is required (Step B).');
        if (!data.SIGNER_NAME)               errors.push('Signing Person\'s Name is required (Step B).');
        if (!data.SIGNER_EMAIL)              errors.push('Signer\'s Email is required (Step B).');
      }
    }

    if (isCirc && !data.TRANSACTION_CONCEPT) {
      errors.push('Transaction Concept Name is required for the Non-Circumvention Agreement (Step A).');
    }

    return errors;
  }

  // ── Submit to queue ──────────────────────────────────────────────────────────
  async function generateDocument() {
    const data   = getPayload();
    const errors = validate(data);

    if (errors.length) {
      errorList.innerHTML = '';
      errors.forEach(e => {
        const li = document.createElement('li');
        li.textContent = e;
        errorList.appendChild(li);
      });
      errorModal.classList.remove('hidden');
      return;
    }

    loadingModal.classList.remove('hidden');

    try {
      const endpoint = data.form_mode === 'annotate' ? '/api/nda/queue' : '/api/nda/queue';
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data)
      });

      loadingModal.classList.add('hidden');

      if (res.ok) {
        if (signerEmailDisplay) {
          signerEmailDisplay.textContent = data.SIGNER_EMAIL || data.COUNTERPARTY_EMAIL || 'the counterparty';
        }
        successModal.classList.remove('hidden');
      } else {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        errorList.innerHTML = '';
        const li = document.createElement('li');
        li.textContent = errData.details || errData.error || 'Failed to queue submission.';
        errorList.appendChild(li);
        errorModal.classList.remove('hidden');
      }
    } catch (err) {
      loadingModal.classList.add('hidden');
      alert(`Network error: ${err.message}`);
    }
  }

  // ── Modal close handlers ─────────────────────────────────────────────────────
  closeSuccessBtn.addEventListener('click', () => successModal.classList.add('hidden'));
  closeErrorBtn.addEventListener('click',   () => errorModal.classList.add('hidden'));

  // ── Init ─────────────────────────────────────────────────────────────────────
  applyDocType('nda_standard');
  updateNavButtons();
});
