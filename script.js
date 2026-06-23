/* ============================================================
   MedCert – script.js
   ============================================================ */

function updateClock() {
  const el = document.getElementById("clock");
  if (!el) return;

  const now = new Date();
  el.textContent = now.toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseDateParts(dateStr) {
  if (!dateStr) return null;

  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return null;

  return { year, month, day };
}

function formatInputDate(dateStr) {
  const parts = parseDateParts(dateStr);
  if (!parts) return "—";

  const date = new Date(parts.year, parts.month - 1, parts.day);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatMoney(amount) {
  return `฿ ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function generateDocumentNo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const timePart = String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");

  return `MC-${year}${month}${day}-${timePart}`;
}

function buildShareText(certificateData) {
  return [
    "Medical Certificate & Receipt",
    `Certificate No: ${certificateData.certificateNo}`,
    `Patient: ${certificateData.patient.name || "-"}`,
    `Date of Examination: ${formatInputDate(certificateData.examination.date)}`,
    `Place: ${certificateData.examination.place || "-"}`,
    `Diagnosis: ${certificateData.examination.diagnosis || "-"}`,
    `Doctor: ${certificateData.doctor.name || "-"}`,
    `Total Fee: ${formatMoney(certificateData.billing.totalFee)}`,
  ].join("\n");
}

function openShareWindow(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

async function exportPdf() {
  if (!currentCertificateData) {
    alert("Please generate a document first.");
    return;
  }

  try {
    const { fileName } = await buildPdfFile(currentCertificateData, true);
    console.log(`PDF exported: ${fileName}`);
  } catch (error) {
    console.error("Export PDF failed:", error);
    alert("Export PDF failed. Please try again.");
  }
}

async function buildPdfFile(certificateData, shouldDownload = false) {
  if (typeof html2pdf === "undefined") {
    alert("PDF library failed to load. Please refresh and try again.");
    throw new Error("PDF library failed to load");
  }

  document.body.classList.add("pdf-export");

  const previewContainer = document.querySelector(".preview-container");
  const fileName = `${certificateData.certificateNo}.pdf`;
  const options = {
    margin: [5, 5, 5, 5],
    filename: fileName,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    },
    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait",
    },
    pagebreak: {
      mode: ["css", "legacy"],
    },
  };

  try {
    const worker = html2pdf().set(options).from(previewContainer);
    const pdfDocument = await worker.toPdf().get("pdf");
    const blob = pdfDocument.output("blob");

    if (shouldDownload) {
      await worker.save();
    }

    return { blob, fileName };
  } finally {
    document.body.classList.remove("pdf-export");
  }
}

async function sharePdfOrDownload(certificateData) {
  const { blob, fileName } = await buildPdfFile(certificateData, false);
  const pdfFile = new File([blob], fileName, { type: "application/pdf" });

  if (
    navigator.share &&
    navigator.canShare &&
    navigator.canShare({ files: [pdfFile] })
  ) {
    await navigator.share({
      title: certificateData.certificateNo,
      text: "Medical Certificate and Receipt PDF",
      files: [pdfFile],
    });
    return "shared";
  }

  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
  return "downloaded";
}

async function copyShareText() {
  if (!currentCertificateData) {
    alert("Please generate a document first.");
    return;
  }

  try {
    await navigator.clipboard.writeText(buildShareText(currentCertificateData));
    alert("Share text copied. You can paste it into LINE or WeChat.");
  } catch (error) {
    alert("Copy failed. Please copy the text manually.");
  }
}

function shareToLine() {
  if (!currentCertificateData) {
    alert("Please generate a document first.");
    return;
  }

  const shareText = encodeURIComponent(buildShareText(currentCertificateData));
  openShareWindow(`https://line.me/R/msg/text/?${shareText}`);
}

function shareToWhatsapp() {
  if (!currentCertificateData) {
    alert("Please generate a document first.");
    return;
  }

  const shareText = encodeURIComponent(buildShareText(currentCertificateData));
  openShareWindow(`https://wa.me/?text=${shareText}`);
}

async function shareToWechat() {
  if (!currentCertificateData) {
    alert("Please generate a document first.");
    return;
  }

  const shareText = buildShareText(currentCertificateData);

  try {
    await navigator.clipboard.writeText(shareText);
    alert("Share text copied. Paste it into WeChat.");
  } catch (error) {
    alert("Copy failed. Please copy the document details manually.");
  }

  openShareWindow("https://web.wechat.com/");
}

updateClock();
setInterval(updateClock, 1000);

let currentCertificateData = null;
let isSavingCertificate = false;
const FORM_DRAFT_STORAGE_KEY = "medcert.formDraft";

const feeIds = ["consultFee", "medFee", "procFee", "certFee"];
const API_BASE_URL = getApiBaseUrl();

function getApiBaseUrl() {
  const isLocalHost =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost";

  if (isLocalHost && window.location.port !== "3000") {
    return "http://localhost:3000";
  }

  return window.location.origin;
}

function calculateTotal() {
  const total = feeIds.reduce((sum, id) => {
    const value = parseFloat(document.getElementById(id).value) || 0;
    return sum + value;
  }, 0);

  document.getElementById("totalAmount").textContent = formatMoney(total);
  return total;
}

function getFormFields() {
  return document.querySelectorAll("#formPage input, #formPage select, #formPage textarea");
}

function saveFormDraft() {
  const draft = {};

  getFormFields().forEach((element) => {
    if (!element.id) return;
    draft[element.id] = element.type === "checkbox" ? element.checked : element.value;
  });

  sessionStorage.setItem(FORM_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

function restoreFormDraft() {
  const rawDraft = sessionStorage.getItem(FORM_DRAFT_STORAGE_KEY);
  if (!rawDraft) return;

  try {
    const draft = JSON.parse(rawDraft);

    Object.entries(draft).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (!element) return;

      if (element.type === "checkbox") {
        element.checked = Boolean(value);
      } else {
        element.value = value;
      }
    });

    calculateTotal();
  } catch (error) {
    console.error("Restore form draft failed:", error);
    sessionStorage.removeItem(FORM_DRAFT_STORAGE_KEY);
  }
}

function persistPreviewState(certificateData) {
  sessionStorage.setItem("medcert.previewData", JSON.stringify(certificateData));
  sessionStorage.setItem("medcert.activePage", "previewPage");
}

function clearPreviewState() {
  sessionStorage.removeItem("medcert.previewData");
  sessionStorage.removeItem("medcert.activePage");
}

function restorePreviewState() {
  const savedPage = sessionStorage.getItem("medcert.activePage");
  const savedData = sessionStorage.getItem("medcert.previewData");

  if (savedPage !== "previewPage" || !savedData) return;

  try {
    const certificateData = JSON.parse(savedData);
    currentCertificateData = certificateData;
    renderPreview(certificateData);
    showPage("previewPage");
  } catch (error) {
    console.error("Restore preview state failed:", error);
    clearPreviewState();
  }
}

feeIds.forEach((id) => {
  document.getElementById(id).addEventListener("input", calculateTotal);
});

getFormFields().forEach((element) => {
  const eventName = element.tagName === "SELECT" || element.type === "checkbox"
    ? "change"
    : "input";
  element.addEventListener(eventName, saveFormDraft);
});

const REQUIRED_FIELDS = [
  { id: "patientName", label: "Patient Name" },
  { id: "birthdate", label: "Birthdate" },
  { id: "gender", label: "Gender" },
  { id: "idNumber", label: "ID / Passport No." },
  { id: "examDate", label: "Date of examination" },
  { id: "examPlace", label: "Place of examination" },
  { id: "chiefComplaint", label: "Chief complaint" },
  { id: "diagnosis", label: "Diagnosis" },
  { id: "doctorName", label: "Doctor name" },
  { id: "licenseNo", label: "Medical license no." },
];

function validateForm() {
  const missing = [];

  REQUIRED_FIELDS.forEach((field) => {
    document.getElementById(field.id).classList.remove("error");
  });

  REQUIRED_FIELDS.forEach((field) => {
    const element = document.getElementById(field.id);
    if (!element.value.trim()) {
      element.classList.add("error");
      missing.push(field.label);
    }
  });

  return missing;
}

function collectData() {
  const getValue = (id) => document.getElementById(id).value.trim();
  const getNumber = (id) => parseFloat(document.getElementById(id).value) || 0;
  const getChecked = (id) => document.getElementById(id).checked;

  const certificateData = {
    certificateNo: generateDocumentNo(),
    patient: {
      name: getValue("patientName"),
      birthdate: getValue("birthdate"),
      gender: getValue("gender"),
      nationality: getValue("nationality"),
      idPassportNo: getValue("idNumber"),
    },
    examination: {
      date: getValue("examDate"),
      place: getValue("examPlace"),
      chiefComplaint: getValue("chiefComplaint"),
      clinicalFindings: getValue("clinicalFindings"),
      diagnosis: getValue("diagnosis"),
      medication: getValue("medication"),
      procedure: getValue("procedure"),
    },
    medicalAdvice: {
      fitToTravel: getChecked("fitToTravel"),
      fitToFly: getChecked("fitToFly"),
      fitToWork: getChecked("fitToWork"),
      sickLeave: getChecked("sickLeave"),
      bedRest: getChecked("bedRest"),
      followUp: getChecked("followUp"),
      additionalAdvice: getValue("additionalAdvice"),
    },
    doctor: {
      name: getValue("doctorName"),
      licenseNo: getValue("licenseNo"),
    },
    billing: {
      consultationFee: getNumber("consultFee"),
      medicationFee: getNumber("medFee"),
      procedureFee: getNumber("procFee"),
      medicalCertificateFee: getNumber("certFee"),
      totalFee: calculateTotal(),
      paymentMethod: getValue("paymentMethod"),
    },
  };

  return certificateData;
}

function renderAdvice(data) {
  const markers = [
    ["fitToTravel", "mark-fitToTravel"],
    ["fitToFly", "mark-fitToFly"],
    ["fitToWork", "mark-fitToWork"],
    ["sickLeave", "mark-sickLeave"],
    ["bedRest", "mark-bedRest"],
    ["followUp", "mark-followUp"],
  ];

  markers.forEach(([key, id]) => {
    document.getElementById(id).textContent = data.medicalAdvice[key] ? "☑" : "☐";
  });

  if (!data.medicalAdvice.additionalAdvice) {
    document.getElementById("p-remarks").textContent = "—";
  } else {
    document.getElementById("p-remarks").textContent = data.medicalAdvice.additionalAdvice;
  }
}

function renderPreview(certificateData) {
  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = value || "—";
  };

  setText("p-certificateNo", certificateData.certificateNo);
  setText("previewExamPlace", certificateData.examination.place);
  setText("p-name", certificateData.patient.name);
  setText("p-birth", formatInputDate(certificateData.patient.birthdate));
  setText("p-gender", certificateData.patient.gender);
  setText("p-nationality", certificateData.patient.nationality);
  setText("p-id", certificateData.patient.idPassportNo);

  setText("p-examDate", formatInputDate(certificateData.examination.date));
  setText("p-complaint", certificateData.examination.chiefComplaint);
  setText("p-findings", certificateData.examination.clinicalFindings);
  setText("p-diagnosis", certificateData.examination.diagnosis);
  setText("p-medication", certificateData.examination.medication);
  setText("p-procedure", certificateData.examination.procedure);
  setText("p-additionalAdvice", certificateData.medicalAdvice.additionalAdvice);
  setText("p-doctor", certificateData.doctor.name);
  setText("p-license", certificateData.doctor.licenseNo);
  const issuedDateLong = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const issuedDateShort = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  setText(
    "p-issuedDate",
    issuedDateLong,
  );
  setText("p-issuedDateShort", issuedDateShort);
  setText("p-issuedDateShortBottom", issuedDateShort);

  setText("r-certificateNo", certificateData.certificateNo);
  setText("r-issuedDate", issuedDateShort);
  setText("r-issuedDateBottom", issuedDateShort);
  setText("r-paymentMethod", certificateData.billing.paymentMethod);
  setText("r-name", certificateData.patient.name);
  setText("r-id", certificateData.patient.idPassportNo);
  setText("r-place", certificateData.examination.place);
  setText(
    "r-consult-unit",
    formatMoney(certificateData.billing.consultationFee),
  );
  setText(
    "r-consult-amount",
    formatMoney(certificateData.billing.consultationFee),
  );
  setText("r-med-unit", formatMoney(certificateData.billing.medicationFee));
  setText("r-med-amount", formatMoney(certificateData.billing.medicationFee));
  setText("r-proc-unit", formatMoney(certificateData.billing.procedureFee));
  setText("r-proc-amount", formatMoney(certificateData.billing.procedureFee));
  setText(
    "r-cert-unit",
    formatMoney(certificateData.billing.medicalCertificateFee),
  );
  setText(
    "r-cert-amount",
    formatMoney(certificateData.billing.medicalCertificateFee),
  );
  setText("r-subtotal", formatMoney(certificateData.billing.totalFee));
  setText("r-discount", formatMoney(0));
  setText("r-net-total", formatMoney(certificateData.billing.totalFee));
  setText("r-vat", formatMoney(0));
  setText("r-grand-total", formatMoney(certificateData.billing.totalFee));

  renderAdvice(certificateData);
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  document.getElementById(pageId).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("generateBtn").addEventListener("click", () => {
  const missingFields = validateForm();
  const errorBanner = document.getElementById("errorBanner");
  const errorMessage = document.getElementById("errorMessage");

  if (missingFields.length > 0) {
    errorMessage.textContent = `Please fill in: ${missingFields.join(", ")}`;
    errorBanner.classList.remove("hidden");

    const firstError = document.querySelector(".error");
    if (firstError) {
      firstError.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return;
  }

  errorBanner.classList.add("hidden");

  const certificateData = collectData();
  currentCertificateData = certificateData;
  console.log(certificateData);

  renderPreview(certificateData);
  persistPreviewState(certificateData);
  showPage("previewPage");
});

document.getElementById("backBtn").addEventListener("click", () => {
  sessionStorage.setItem("medcert.activePage", "formPage");
  showPage("formPage");
});

document.getElementById("exportPdfBtn").addEventListener("click", () => {
  exportPdf();
});

document.getElementById("sharePdfBtn").addEventListener("click", async () => {
  if (!currentCertificateData) {
    alert("Please generate a document first.");
    return;
  }

  try {
    const outcome = await sharePdfOrDownload(currentCertificateData);
    if (outcome === "downloaded") {
      alert("PDF downloaded. Send the file to the patient from your chat app.");
    }
  } catch (error) {
    console.error("Share PDF failed:", error);
    alert("Share PDF failed. Please try Export PDF instead.");
  }
});

document.getElementById("shareBtn").addEventListener("click", () => {
  document.getElementById("shareMenu").classList.toggle("hidden");
});

document.getElementById("copyTextBtn").addEventListener("click", async () => {
  await copyShareText();
  document.getElementById("shareMenu").classList.add("hidden");
});

document.getElementById("shareLineBtn").addEventListener("click", () => {
  shareToLine();
  document.getElementById("shareMenu").classList.add("hidden");
});

document.getElementById("shareWechatBtn").addEventListener("click", () => {
  shareToWechat();
  document.getElementById("shareMenu").classList.add("hidden");
});

document.getElementById("shareWhatsappBtn").addEventListener("click", () => {
  shareToWhatsapp();
  document.getElementById("shareMenu").classList.add("hidden");
});

document.getElementById("saveBtn").addEventListener("click", () => {
  saveCertificate();
});

document.getElementById("clearBtn").addEventListener("click", () => {
  if (!confirm("Clear all form data?")) return;

  document
    .querySelectorAll("#formPage input, #formPage select, #formPage textarea")
    .forEach((element) => {
      if (element.type === "checkbox") {
        element.checked = false;
      } else {
        element.value = "";
      }
      element.classList.remove("error");
    });

  document.getElementById("errorBanner").classList.add("hidden");
  document.getElementById("totalAmount").textContent = formatMoney(0);
  sessionStorage.removeItem(FORM_DRAFT_STORAGE_KEY);
  clearPreviewState();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.addEventListener("click", (event) => {
  const shareMenu = document.getElementById("shareMenu");
  const shareWrapper = document.querySelector(".share-menu-wrapper");

  if (!shareWrapper.contains(event.target)) {
    shareMenu.classList.add("hidden");
  }
});

async function saveCertificate() {
  if (isSavingCertificate) return;

  const saveButton = document.getElementById("saveBtn");
  const certificateData = collectData();

  try {
    isSavingCertificate = true;
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    const response = await fetch(`${API_BASE_URL}/certificates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(certificateData),
    });

    const rawText = await response.text();
    const result = rawText ? JSON.parse(rawText) : {};

    if (!response.ok) {
      throw new Error(result.error || result.message || "Failed to save certificate");
    }

    console.log("Saved certificate:", result);
    currentCertificateData = certificateData;
    renderPreview(certificateData);
    saveFormDraft();
    persistPreviewState(certificateData);
    showPage("previewPage");
    saveButton.textContent = "Preparing PDF...";

    try {
      const outcome = await sharePdfOrDownload(certificateData);
      if (outcome === "shared") {
        alert(
          `Save successful. Certificate ID: ${result.certificateId}\n\nPDF share sheet opened. Send it to the patient for printing.`,
        );
      } else {
        alert(
          `Save successful. Certificate ID: ${result.certificateId}\n\nPDF downloaded. Send the file to the patient for printing.`,
        );
      }
    } catch (shareError) {
      console.error("Share/Download PDF failed:", shareError);
      alert(
        `Save successful. Certificate ID: ${result.certificateId}\n\nBut PDF export failed.`,
      );
    }
  } catch (error) {
    console.error("Save failed:", error);
    alert(`Save failed: ${error.message}`);
  } finally {
    isSavingCertificate = false;
    saveButton.disabled = false;
    saveButton.textContent = "💾 Save Record";
  }
}

restoreFormDraft();
restorePreviewState();
