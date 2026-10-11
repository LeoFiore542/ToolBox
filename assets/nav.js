(function () {
  const body = document.body;
  const toggle = document.getElementById("sidebar-toggle");
  const closeBtn = document.getElementById("sidebar-close");
  const backdrop = document.getElementById("sidebar-backdrop");
  const sidebar = document.getElementById("sidebar");

  if (!toggle || !sidebar) return;

  function setOpen(open) {
    body.classList.toggle("sidebar-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    sidebar.setAttribute("aria-hidden", String(!open));
    if (backdrop) backdrop.setAttribute("aria-hidden", String(!open));
  }

  function open() {
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  function toggleSidebar() {
    setOpen(!body.classList.contains("sidebar-open"));
  }

  toggle.addEventListener("click", toggleSidebar);
  closeBtn?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  setOpen(false);
})();
