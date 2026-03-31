// MyRight v2 — Landing Page JS
document.addEventListener('DOMContentLoaded', () => {

  // --- Scroll animations ---
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.animation = 'fadeUp 0.6s ease both';
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.doc-card, .step, .trust-item, .plan-card').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });

  // --- Smooth anchor scroll ---
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (href === '#' || href === '#!') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});
async function generateDocument(docType, formData) {
  try {
    const response = await fetch(
      "https://myright-api.ananthuapi123.workers.dev/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          docType,
          formData
        })
      }
    );

    if (!response.ok) {
      throw new Error("Server error");
    }

    const data = await response.json();

    if (data.error) {
      alert(data.error);
      return null;
    }

    return data.content;

  } catch (err) {
    console.error(err);
    alert("Something went wrong. Please try again.");
    return null;
  }
}