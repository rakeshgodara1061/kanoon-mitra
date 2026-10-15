(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const searchInput = $("#searchInput");
  const typeFilter = $("#typeFilter");
  const categoryFilter = $("#categoryFilter");
  const audienceFilter = $("#audienceFilter");
  const results = $("#results");
  const status = $("#status");
  const emptyState = $("#emptyState");
  const resultCount = $("#resultCount");
  const sectionTitle = $("#sectionTitle");
  const modal = $("#detailModal");
  let records = [];
  let activeTab = "all";

  const safe = (value) => String(value ?? "");
  const escapeHtml = (value) => safe(value).replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[ch]);
  const searchableText = (item) => [
    item.title, item.category, item.reference, item.summary, item.explanation,
    item.facts, item.question, item.decision, item.importance,
    ...(item.examPoints || []), ...(item.audience || [])
  ].join(" ").toLocaleLowerCase("hi");

  function populateCategories() {
    const selected = categoryFilter.value;
    const categories = [...new Set(records.map(item => item.category).filter(Boolean))]
      .sort((a,b) => a.localeCompare(b, "hi"));
    categoryFilter.innerHTML = '<option value="all">सभी विषय</option>' +
      categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
    if (categories.includes(selected)) categoryFilter.value = selected;
  }

  function makeCard(item) {
    const isCase = item.type === "case";
    const tag = isCase ? "महत्वपूर्ण केस लॉ" : (item.category || "कानून");
    const ref = item.reference ? `<div class="meta">${escapeHtml(item.reference)}</div>` : "";
    const source = item.sourceUrl ? `<a class="source-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">आधिकारिक / स्रोत लिंक ↗</a>` : "";
    return `<article class="card">
      <span class="tag">${escapeHtml(tag)}</span>
      <h2>${escapeHtml(item.title)}</h2>
      ${ref}
      <p>${escapeHtml(item.summary || "")}</p>
      <div class="card-actions">
        <button class="detail-btn" type="button" data-detail="${escapeHtml(item.id)}">पूरा विवरण पढ़ें</button>
        ${source}
      </div>
    </article>`;
  }

  function filteredRecords() {
    const query = searchInput.value.trim().toLocaleLowerCase("hi");
    const type = typeFilter.value;
    const category = categoryFilter.value;
    const audience = audienceFilter.value;
    return records.filter(item => {
      const matchesTab = activeTab === "all" || item.type === activeTab;
      const matchesType = type === "all" || item.type === type;
      const matchesCategory = category === "all" || item.category === category;
      const matchesAudience = audience === "all" || (item.audience || []).includes(audience);
      const matchesQuery = !query || searchableText(item).includes(query);
      return matchesTab && matchesType && matchesCategory && matchesAudience && matchesQuery;
    });
  }

  function render() {
    const list = filteredRecords();
    results.innerHTML = list.map(makeCard).join("");
    resultCount.textContent = `${list.length} परिणाम`;
    emptyState.classList.toggle("hidden", list.length !== 0);
    if (activeTab === "law") sectionTitle.textContent = "कानून और धाराएँ";
    else if (activeTab === "case") sectionTitle.textContent = "महत्वपूर्ण केस लॉ";
    else sectionTitle.textContent = "सभी कानूनी सामग्री";
  }

  function detailParagraph(label, value) {
    if (!value) return "";
    return `<h3>${escapeHtml(label)}</h3><p>${escapeHtml(value)}</p>`;
  }

  function openDetail(id) {
    const item = records.find(record => record.id === id);
    if (!item) return;
    $("#modalTag").textContent = item.category || (item.type === "case" ? "केस लॉ" : "कानून");
    $("#modalTitle").textContent = item.title;
    let body = "";
    if (item.type === "case") {
      body += detailParagraph("संदर्भ", item.reference);
      body += detailParagraph("मामले के तथ्य", item.facts);
      body += detailParagraph("कानूनी प्रश्न", item.question);
      body += detailParagraph("न्यायालय का निर्णय", item.decision);
      body += detailParagraph("महत्व", item.importance);
    } else {
      body += detailParagraph("धारा / संदर्भ", item.reference);
      body += detailParagraph("सरल अर्थ", item.explanation || item.summary);
      body += detailParagraph("उदाहरण", item.example);
      if (item.examPoints && item.examPoints.length) {
        body += `<h3>परीक्षा के लिए मुख्य बिंदु</h3><ul>${item.examPoints.map(point => `<li>${escapeHtml(point)}</li>`).join("")}</ul>`;
      }
    }
    if (item.sourceUrl) body += `<p><a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">स्रोत / आधिकारिक कानून देखें ↗</a></p>`;
    body += '<div class="disclaimer"><strong>ध्यान दें:</strong> यह सामान्य शैक्षिक सारांश है। सटीक भाषा, संशोधन, लागू तारीख और वर्तमान न्यायिक स्थिति के लिए आधिकारिक पाठ देखें।</div>';
    $("#modalBody").innerHTML = body;
    modal.classList.add("open");
    $("#closeModal").focus();
  }

  async function loadData() {
    try {
      const [lawResponse, caseResponse] = await Promise.all([
        fetch("./laws.json", {cache:"no-cache"}),
        fetch("./cases.json", {cache:"no-cache"})
      ]);
      if (!lawResponse.ok || !caseResponse.ok) throw new Error("डेटा फ़ाइल नहीं मिली");
      const [lawData, caseData] = await Promise.all([lawResponse.json(), caseResponse.json()]);
      if (!Array.isArray(lawData) || !Array.isArray(caseData)) throw new Error("JSON फ़ाइल का प्रारूप सही नहीं है");
      records = [...lawData, ...caseData];
      populateCategories();
      status.classList.add("hidden");
      render();
    } catch (error) {
      status.innerHTML = 'जानकारी लोड नहीं हो पाई। जाँचें कि <code>law-library.html</code>, <code>laws.json</code>, <code>cases.json</code> और <code>script.js</code> एक ही फ़ोल्डर में हैं और JSON फ़ाइलों में वैध डेटा है।<br><br>GitHub Pages पर प्रकाशित वेबसाइट से खोलकर फिर कोशिश करें।';
      resultCount.textContent = "लोड त्रुटि";
      console.error(error);
    }
  }

  [searchInput, typeFilter, categoryFilter, audienceFilter].forEach(el => {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });
  $("#clearBtn").addEventListener("click", () => {
    searchInput.value = "";
    typeFilter.value = "all";
    categoryFilter.value = "all";
    audienceFilter.value = "all";
    activeTab = "all";
    document.querySelectorAll(".tab").forEach(tab => tab.setAttribute("aria-pressed", String(tab.dataset.tab === "all")));
    render();
    searchInput.focus();
  });
  document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => {
    activeTab = tab.dataset.tab;
    document.querySelectorAll(".tab").forEach(other => other.setAttribute("aria-pressed", String(other === tab)));
    render();
  }));
  results.addEventListener("click", event => {
    const button = event.target.closest("[data-detail]");
    if (button) openDetail(button.dataset.detail);
  });
  $("#closeModal").addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", event => { if (event.target === modal) modal.classList.remove("open"); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") modal.classList.remove("open"); });
  loadData();
})();