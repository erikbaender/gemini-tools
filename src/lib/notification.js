(function initNotification(global) {
  "use strict";

  const NOTIFICATION_ID = "gmk-correction-toast";

  function removeExisting() {
    const existing = document.getElementById(NOTIFICATION_ID);
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }

  function show(message) {
    removeExisting();

    const toast = document.createElement("div");
    toast.id = NOTIFICATION_ID;
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.bottom = "18px";
    toast.style.right = "18px";
    toast.style.zIndex = "2147483647";
    toast.style.maxWidth = "380px";
    toast.style.padding = "10px 12px";
    toast.style.borderRadius = "10px";
    toast.style.border = "1px solid #e0e0e0";
    toast.style.background = "#f5f5f5";
    toast.style.color = "#212121";
    toast.style.font = "500 13px/1.35 system-ui, -apple-system, Segoe UI, sans-serif";
    toast.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.1)";
    toast.style.pointerEvents = "none";
    toast.style.opacity = "0";
    toast.style.transform = "translateY(6px)";
    toast.style.transition = "opacity 160ms ease, transform 160ms ease";

    document.documentElement.appendChild(toast);

    global.requestAnimationFrame(function onFrame() {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });

    global.setTimeout(function hideToast() {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(6px)";
      global.setTimeout(removeExisting, 180);
    }, 2600);
  }

  global.GPE_Notification = {
    show
  };
})(globalThis);
