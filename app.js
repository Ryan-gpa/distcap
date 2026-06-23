// app.js — Distillery Capital Proposal Generator UI Controller

document.addEventListener("DOMContentLoaded", () => {
  // --- State ---
  let activeTab = "client";
  let deliverables = ["", "", ""]; // 3 initial blank deliverables
  let obligations = [""]; // 1 initial blank obligation
  let selectedCoverFile = null;

  const TABS_ORDER = ["client", "engagement", "meeting", "scope", "team", "commercial", "assets", "drafts"];

  const DEMO_ANSWERS = {
    CLIENT_NAME: "Police Citizens Youth Clubs NSW",
    CLIENT_LEGAL_ENTITY: "Police Citizens Youth Clubs NSW Ltd (ABN 89 401 152 271)",
    CLIENT_SHORT_NAME: "PCYC NSW",
    PROJECT_NAME: "Property Portfolio & Capital Strategy",
    PROJECT_DESCRIPTION: "proposed strategic review and optimization of the PCYC NSW club property portfolio and capital works program",
    ENGAGEMENT_TYPE: "Strategic Property Advisory",
    SERVICE_DESCRIPTOR: "strategic property advisory",
    ADVISOR_ROLE: "strategic property",
    DATE_ISSUE: new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
    YEAR: new Date().getFullYear().toString(),
    CONTACT_NAME: "Ben Hobby",
    CONTACT_FIRST_NAME: "Ben",
    CONTACT_TITLE: "Chief Executive Officer",
    CONTACT_EMAIL: "bhobby@pcycnsw.org.au",
    ADDRESS_1: "Suite 2, 6B Figtree Drive",
    ADDRESS_2: "Sydney Olympic Park NSW 2127",
    DECISION_MAKER: "the PCYC Board of Directors",
    INITIAL_TERM: "two (2) months",
    MEETING_CONTACT: "Ben Hobby",
    MEETING_LEAD: "Phillip Ransom",
    MEETING_LOCATION: "2/6B Figtree Drive, Sydney Olympic Park",
    MEETING_DATE: "Tuesday, 9 June 2026",
    REQUIREMENT_SUMMARY: "provide strategic real estate advisory services to assist PCYC NSW in optimizing its club property portfolio and capital redevelopment program",
    AVAILABILITY_WINDOW: "two to three months",
    DAYS_PER_WEEK_INITIAL: "2",
    COMMITMENT_PERIOD: "the first six weeks",
    DAYS_PER_WEEK_STEPDOWN: "1",
    TEAM_MEMBERS: "Phillip Ransom, Managing Director and Engagement Lead",
    CV_PAGES: "Phillip Ransom (Managing Director)",
    fee_basis: "time_and_materials",
    FEE_MONTHLY_ESTIMATE: "28,000",
    RATE_MD: "$550/hr",
    RATE_ADVISOR: "$350/hr",
    RATE_ANALYST: "$100/hr",
    FIXED_FEE_AMOUNT: "",
    FIXED_FEE_MILESTONES: "",
    INVOICING_BASIS: "monthly in arrears",
    draft_status: "draft",
    highlight_filled: "false",
    use_pcyc_cover: "true"
  };

  const DEMO_DELIVERABLES = [
    "Conduct a comprehensive audit of current club properties and lease structures",
    "Develop a prioritization framework for capital works and facility redevelopments",
    "Identify commercial opportunities for co-location and joint ventures",
    "Prepare a property portfolio optimization report and action plan"
  ];

  const DEMO_OBLIGATIONS = [
    "Provide access to all club asset registers, lease documents, and recent property valuations",
    "Facilitate site visits and coordinate interviews with key regional club managers"
  ];

  // --- Element Selectors ---
  const tabItems = document.querySelectorAll(".step-item");
  const formTabs = document.querySelectorAll(".form-tab");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const generateBtn = document.getElementById("generateBtn");
  const generateTemplateBtn = document.getElementById("generateTemplateBtn");
  const proposalForm = document.getElementById("proposalForm");
  const loadDemoBtn = document.getElementById("loadDemoBtn");
  const clearFormBtn = document.getElementById("clearFormBtn");

  const deliverablesContainer = document.getElementById("deliverablesContainer");
  const addDeliverableBtn = document.getElementById("addDeliverableBtn");
  const obligationsContainer = document.getElementById("obligationsContainer");
  const addObligationBtn = document.getElementById("addObligationBtn");

  const feeBasisRadios = document.getElementsByName("fee_basis");
  const sectionTM = document.getElementById("section-tm");
  const sectionFixed = document.getElementById("section-fixed");

  const coverDropzone = document.getElementById("coverDropzone");
  const coverImageInput = document.getElementById("cover_image");
  const coverPreviewContainer = document.getElementById("coverPreviewContainer");
  const coverPreview = document.getElementById("coverPreview");
  const removeCoverBtn = document.getElementById("removeCoverBtn");
  const dropzoneText = coverDropzone.querySelector(".dropzone-text");

  // Drafts
  const draftNameInput = document.getElementById("draftNameInput");
  const saveDraftBtn = document.getElementById("saveDraftBtn");
  const draftsListContainer = document.getElementById("draftsListContainer");

  // Modals
  const loadingModal = document.getElementById("loadingModal");
  const successModal = document.getElementById("successModal");
  const errorModal = document.getElementById("errorModal");
  const errorList = document.getElementById("errorList");
  const downloadedFilename = document.getElementById("downloadedFilename");

  const closeErrorBtn = document.getElementById("closeErrorBtn");
  const closeSuccessBtn = document.getElementById("closeSuccessBtn");

  // Custom Confirm Modal Selectors
  const confirmModal = document.getElementById("confirmModal");
  const cancelClearBtn = document.getElementById("cancelClearBtn");
  const confirmClearBtn = document.getElementById("confirmClearBtn");

  // --- Tab Navigation ---
  function switchTab(tabId) {
    activeTab = tabId;
    tabItems.forEach(item => {
      if (item.getAttribute("data-tab") === tabId) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    formTabs.forEach(tab => {
      if (tab.id === `tab-${tabId}`) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
      }
    });

    // Update wizard buttons
    const idx = TABS_ORDER.indexOf(tabId);
    prevBtn.disabled = idx === 0;
    
    if (idx === TABS_ORDER.length - 1) {
      nextBtn.textContent = "Finish & Generate";
    } else {
      nextBtn.textContent = "Next Step";
    }

    if (tabId === "drafts") {
      loadDraftsList();
    }
  }

  tabItems.forEach(item => {
    item.addEventListener("click", () => {
      switchTab(item.getAttribute("data-tab"));
    });
  });

  prevBtn.addEventListener("click", () => {
    const idx = TABS_ORDER.indexOf(activeTab);
    if (idx > 0) {
      switchTab(TABS_ORDER[idx - 1]);
    }
  });

  nextBtn.addEventListener("click", () => {
    const idx = TABS_ORDER.indexOf(activeTab);
    if (idx < TABS_ORDER.length - 1) {
      switchTab(TABS_ORDER[idx + 1]);
    } else {
      // Trigger proposal generation on finish step
      generateProposal(false);
    }
  });

  // --- Dynamic Deliverables & Obligations lists ---
  function renderDeliverables() {
    deliverablesContainer.innerHTML = "";
    deliverables.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "list-item-row";
      
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = `Deliverable Activity / Task #${index + 2}`;
      input.value = item;
      input.addEventListener("input", (e) => {
        deliverables[index] = e.target.value;
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-danger btn-sm";
      delBtn.innerHTML = "&times;";
      delBtn.addEventListener("click", () => {
        deliverables.splice(index, 1);
        renderDeliverables();
      });

      row.appendChild(input);
      row.appendChild(delBtn);
      deliverablesContainer.appendChild(row);
    });
  }

  addDeliverableBtn.addEventListener("click", () => {
    deliverables.push("");
    renderDeliverables();
  });

  function renderObligations() {
    obligationsContainer.innerHTML = "";
    obligations.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "list-item-row";

      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Describe client obligation...";
      input.value = item;
      input.addEventListener("input", (e) => {
        obligations[index] = e.target.value;
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-danger btn-sm";
      delBtn.innerHTML = "&times;";
      delBtn.addEventListener("click", () => {
        obligations.splice(index, 1);
        renderObligations();
      });

      row.appendChild(input);
      row.appendChild(delBtn);
      obligationsContainer.appendChild(row);
    });
  }

  addObligationBtn.addEventListener("click", () => {
    obligations.push("");
    renderObligations();
  });

  // --- Fee Basis Configuration Toggle ---
  feeBasisRadios.forEach(radio => {
    radio.addEventListener("change", (e) => {
      if (e.target.value === "time_and_materials") {
        sectionTM.classList.remove("hidden");
        sectionFixed.classList.add("hidden");
      } else {
        sectionTM.classList.add("hidden");
        sectionFixed.classList.remove("hidden");
      }
    });
  });

  // --- Cover Image Dropzone Drag & Drop ---
  coverDropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    coverDropzone.classList.add("dragover");
  });

  coverDropzone.addEventListener("dragleave", () => {
    coverDropzone.classList.remove("dragover");
  });

  coverDropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    coverDropzone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      handleCoverFile(e.dataTransfer.files[0]);
    }
  });

  coverImageInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleCoverFile(e.target.files[0]);
    }
  });

  function handleCoverFile(file) {
    if (!file.type.match("image.*")) {
      alert("Please upload an image file (PNG/JPEG).");
      return;
    }
    selectedCoverFile = file;
    const usePcycCoverInput = document.getElementById("use_pcyc_cover");
    if (usePcycCoverInput) usePcycCoverInput.value = "false";
    
    const reader = new FileReader();
    reader.onload = (e) => {
      coverPreview.src = e.target.result;
      coverPreviewContainer.classList.remove("hidden");
      dropzoneText.classList.add("hidden");
    };
    reader.readAsDataURL(file);
  }

  removeCoverBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    selectedCoverFile = null;
    coverImageInput.value = "";
    const usePcycCoverInput = document.getElementById("use_pcyc_cover");
    if (usePcycCoverInput) usePcycCoverInput.value = "false";
    coverPreviewContainer.classList.add("hidden");
    dropzoneText.classList.remove("hidden");
  });

  // --- Preset Loaders ---
  loadDemoBtn.addEventListener("click", () => {
    // Fill main text fields
    Object.keys(DEMO_ANSWERS).forEach(key => {
      const el = document.getElementById(key);
      if (el) {
        el.value = DEMO_ANSWERS[key];
      }
    });

    // Handle Fee Basis Model
    const radio = document.querySelector(`input[name="fee_basis"][value="${DEMO_ANSWERS.fee_basis}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event("change"));
    }

    // Load deliverables & obligations
    deliverables = [...DEMO_DELIVERABLES];
    obligations = [...DEMO_OBLIGATIONS];
    
    renderDeliverables();
    renderObligations();
    
    // Set auto-generated cover preview in UI
    coverPreview.src = "pcyc_cover.png";
    coverPreviewContainer.classList.remove("hidden");
    dropzoneText.classList.add("hidden");
    
    alert("PCYC NSW demo preset loaded successfully!");
  });

  clearFormBtn.addEventListener("click", () => {
    confirmModal.classList.remove("hidden");
  });

  cancelClearBtn.addEventListener("click", () => {
    confirmModal.classList.add("hidden");
  });

  confirmClearBtn.addEventListener("click", () => {
    proposalForm.reset();
    deliverables = ["", "", ""];
    obligations = [""];
    renderDeliverables();
    renderObligations();
    selectedCoverFile = null;
    coverPreviewContainer.classList.add("hidden");
    dropzoneText.classList.remove("hidden");
    confirmModal.classList.add("hidden");
    switchTab("client");
  });

  // --- Drafts Persistence on Server ---
  async function loadDraftsList() {
    try {
      const res = await fetch("/api/drafts");
      const data = await res.json();
      draftsListContainer.innerHTML = "";
      
      if (!data.drafts || data.drafts.length === 0) {
        draftsListContainer.innerHTML = '<p class="no-drafts">No drafts saved in workspace yet.</p>';
        return;
      }

      data.drafts.forEach(draft => {
        const item = document.createElement("div");
        item.className = "draft-item";
        
        const info = document.createElement("div");
        info.className = "draft-info";
        info.innerHTML = `<span class="draft-name">${draft}</span>`;
        
        const acts = document.createElement("div");
        acts.className = "draft-item-actions";
        
        const loadBtn = document.createElement("button");
        loadBtn.type = "button";
        loadBtn.className = "btn btn-secondary btn-sm";
        loadBtn.textContent = "Load";
        loadBtn.addEventListener("click", () => loadDraft(draft));

        acts.appendChild(loadBtn);
        item.appendChild(info);
        item.appendChild(acts);
        draftsListContainer.appendChild(item);
      });
    } catch (err) {
      console.error("Error loading drafts:", err);
    }
  }

  async function loadDraft(name) {
    try {
      const res = await fetch(`/api/drafts/${name}`);
      if (!res.ok) throw new Error("Draft not found");
      const data = await res.json();
      
      const answers = data.answers || {};
      Object.keys(answers).forEach(key => {
        const el = document.getElementById(key);
        if (el) {
          el.value = answers[key];
        }
      });

      // Handle Fee Basis Model
      if (answers.fee_basis) {
        const radio = document.querySelector(`input[name="fee_basis"][value="${answers.fee_basis}"]`);
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event("change"));
        }
      }

      deliverables = data.deliverables || ["", "", ""];
      obligations = data.obligations || [""];
      
      renderDeliverables();
      renderObligations();
      
      alert(`Loaded draft "${name}"`);
      switchTab("client");
    } catch (err) {
      alert(`Failed to load draft: ${err.message}`);
    }
  }

  saveDraftBtn.addEventListener("click", async () => {
    const name = draftNameInput.value.trim();
    if (!name) {
      alert("Please enter a name for the draft file.");
      return;
    }

    const payload = getFormPayload();
    try {
      const res = await fetch(`/api/drafts/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert(`Draft "${name}" saved to files/drafts/ successfully.`);
        draftNameInput.value = "";
        loadDraftsList();
      } else {
        throw new Error(data.error || "Save failed");
      }
    } catch (err) {
      alert(`Failed to save draft: ${err.message}`);
    }
  });

  // --- Helper: Gather answers from form fields ---
  function getFormPayload() {
    const formData = new FormData(proposalForm);
    const answers = {};
    
    // Fill text inputs
    formData.forEach((val, key) => {
      if (key !== "cover_image" && key !== "fee_basis") {
        answers[key] = val;
      }
    });

    // Handle fee basis
    const selectedFeeRadio = document.querySelector('input[name="fee_basis"]:checked');
    answers.fee_basis = selectedFeeRadio ? selectedFeeRadio.value : "time_and_materials";

    // Set dynamic deliverables & obligations arrays
    const cleanDeliverables = deliverables.filter(d => d.trim() !== "");
    const cleanObligations = obligations.filter(o => o.trim() !== "");

    return {
      answers,
      deliverables: cleanDeliverables,
      obligations: cleanObligations
    };
  }

  // --- Proposal Document Generation Call ---
  async function generateProposal(isTemplateMode = false) {
    const payload = getFormPayload();
    
    // Validate required fields before generating (only if not template mode)
    if (!isTemplateMode) {
      const requiredInputs = proposalForm.querySelectorAll("input[required], select[required]");
      let missing = [];
      requiredInputs.forEach(input => {
        if (!input.value.trim()) {
          const label = input.previousElementSibling ? input.previousElementSibling.textContent : input.name;
          missing.push(label);
        }
      });

      if (missing.length > 0) {
        alert(`Please fill in all required fields before generating:\n\n- ${missing.join("\n- ")}`);
        // Navigate to client tab where most requirements reside
        switchTab("client");
        return;
      }
    }

    // Open loading overlay
    loadingModal.classList.remove("hidden");

    try {
      const form = new FormData();
      // Bundle data variables together
      const answersData = {
        ...payload.answers,
        DELIVERABLES: payload.deliverables,
        CLIENT_OBLIGATION_OTHER: payload.obligations
      };

      form.append("answers", JSON.stringify(answersData));
      form.append("isTemplate", isTemplateMode.toString());
      if (selectedCoverFile) {
        form.append("cover_image", selectedCoverFile);
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        body: form
      });

      if (response.ok) {
        // Server streams the docx directly — convert to blob and trigger download
        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="([^"]+)"/);
        const filename = match ? match[1] : 'DistCap_Proposal.docx';

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Close loading and open success
        loadingModal.classList.add("hidden");
        downloadedFilename.textContent = filename;
        successModal.classList.remove("hidden");
      } else {
        // Fetch failed, handle validation error list
        const errData = await response.json();
        loadingModal.classList.add("hidden");
        
        errorList.innerHTML = "";
        const details = errData.details || [errData.error || "Failed to generate document."];
        details.forEach(detail => {
          const li = document.createElement("li");
          li.textContent = detail;
          errorList.appendChild(li);
        });
        errorModal.classList.remove("hidden");
      }
    } catch (err) {
      loadingModal.classList.add("hidden");
      alert(`Network error: ${err.message}`);
    }
  }

  // --- Button Listeners ---
  generateBtn.addEventListener("click", () => generateProposal(false));
  generateTemplateBtn.addEventListener("click", () => generateProposal(true));

  // --- Modals close button actions ---
  closeErrorBtn.addEventListener("click", () => {
    errorModal.classList.add("hidden");
  });

  closeSuccessBtn.addEventListener("click", () => {
    successModal.classList.add("hidden");
  });

  // --- Initialize lists ---
  renderDeliverables();
  renderObligations();
});
