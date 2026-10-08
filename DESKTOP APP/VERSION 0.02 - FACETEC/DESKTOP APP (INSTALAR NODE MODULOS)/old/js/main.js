/* ============================================================
   EVAH OPHIM — Main (main.js)
   Pricing toggle, general initializations
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // ── Pricing Toggle (Mensal/Anual) ──
  const pricingToggle = document.getElementById('pricingToggle');
  if (pricingToggle) {
    const monthlyLabel = document.getElementById('toggleMonthly');
    const annualLabel = document.getElementById('toggleAnnual');
    const amounts = document.querySelectorAll('.pricing-amount');

    pricingToggle.addEventListener('change', () => {
      const isAnnual = pricingToggle.checked;
      if (monthlyLabel) monthlyLabel.classList.toggle('active', !isAnnual);
      if (annualLabel) annualLabel.classList.toggle('active', isAnnual);

      amounts.forEach(el => {
        const target = isAnnual ? el.dataset.annual : el.dataset.monthly;
        animateNumber(el, parseInt(el.textContent) || 0, parseInt(target));
      });
    });
  }

  function animateNumber(el, from, to) {
    const duration = 400;
    const start = performance.now();
    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  // ── Button Ripple Effect ──
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      ripple.classList.add('ripple');
      const rect = this.getBoundingClientRect();
      ripple.style.left = (e.clientX - rect.left) + 'px';
      ripple.style.top = (e.clientY - rect.top) + 'px';
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });
});
