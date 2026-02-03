(function () {
  const mount = document.getElementById("site-header");
  if (!mount) return;

  mount.innerHTML = `
    <div class="referral-header">
      <img
        src="/images/referral-concierge-header.png"
        alt="Savage Lane Referral Concierge"
        loading="eager"
      />
    </div>
  `;

  // Inject minimal header styles once
  if (!document.getElementById("referral-header-style")) {
    const style = document.createElement("style");
    style.id = "referral-header-style";
    style.textContent = `
      .referral-header {
        width: 100%;
        background: #ffffff;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 14px 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,.06);
      }

.referral-header img {
  width: 100%;
  max-width: 1100px;
  height: auto;
  max-height: 220px;
  object-fit: contain;
  display: block;
}


      @media (max-width: 768px) {
        .referral-header {
          padding: 10px 8px;
        }
      }
    `;
    document.head.appendChild(style);
  }
})();
