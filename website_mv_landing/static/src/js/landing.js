/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";

// ===== Contact Form Handler =====
publicWidget.registry.MVContactForm = publicWidget.Widget.extend({
    selector: '.mv-cta-form',
    events: {
        'submit #mv-contact-form': '_onSubmit',
    },

    start() {
        this._super(...arguments);
        this._fillUtmFromUrl();
    },

    _fillUtmFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
        for (const key of utmKeys) {
            const val = params.get(key);
            if (val) {
                const input = this.el.querySelector(`input[name="${key}"]`);
                if (input) input.value = val;
            }
        }
    },

    _onSubmit(ev) {
        ev.preventDefault();
        const form = ev.currentTarget;
        const messageEl = form.querySelector('#mv-form-message');
        const submitBtn = form.querySelector('button[type="submit"]');

        // Client-side validation
        const name = form.querySelector('[name="name"]').value.trim();
        const email = form.querySelector('[name="email"]').value.trim();
        const interest = form.querySelector('[name="interest"]').value;

        const errors = [];
        if (!name || name.length < 2) errors.push('Zadejte prosím své jméno (min. 2 znaky).');
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            errors.push('Zadejte prosím platný email.');
        if (!interest) errors.push('Vyberte prosím, o co máte zájem.');

        if (errors.length) {
            messageEl.className = 'mv-form-message mv-error';
            messageEl.textContent = errors.join(' ');
            messageEl.style.display = 'block';
            return;
        }

        // Disable submit
        submitBtn.disabled = true;
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Odesílám...';

        const formData = new FormData(form);

        fetch('/mv-landing/contact', {
            method: 'POST',
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
            messageEl.style.display = 'block';
            if (data.success) {
                messageEl.className = 'mv-form-message mv-success';
                messageEl.textContent = data.message;
                form.reset();
                // Facebook Pixel: Lead conversion event
                if (typeof fbq === 'function') {
                    fbq('track', 'Lead');
                }
            } else {
                messageEl.className = 'mv-form-message mv-error';
                messageEl.textContent = data.message;
            }
        })
        .catch(() => {
            messageEl.className = 'mv-form-message mv-error';
            messageEl.textContent = 'Omlouváme se, došlo k chybě. Zkuste to prosím znovu.';
            messageEl.style.display = 'block';
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        });
    },
});

// ===== FAQ Accordion =====
publicWidget.registry.MVFaqAccordion = publicWidget.Widget.extend({
    selector: '.mv-faq',
    events: {
        'click .mv-faq__question': '_onToggle',
    },

    _onToggle(ev) {
        const item = ev.currentTarget.closest('.mv-faq__item');
        const wasActive = item.classList.contains('active');
        // Close all
        this.el.querySelectorAll('.mv-faq__item.active').forEach(i => i.classList.remove('active'));
        // Toggle clicked
        if (!wasActive) item.classList.add('active');
    },
});

// ===== Fade-up Animations =====
publicWidget.registry.MVFadeUp = publicWidget.Widget.extend({
    selector: '#wrap',

    start() {
        this._super(...arguments);
        this._initObserver();
        this._initStickyCta();
        this._initSmoothScroll();
    },

    _initObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.1 });

        this.el.querySelectorAll('.mv-fade-up').forEach(el => observer.observe(el));
    },

    _initStickyCta() {
        const stickyCta = document.getElementById('mvStickyCta');
        if (!stickyCta) return;

        const hero = this.el.querySelector('.mv-hero');
        if (!hero) return;

        const ctaObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    stickyCta.classList.add('visible');
                } else {
                    stickyCta.classList.remove('visible');
                }
            });
        }, { threshold: 0 });

        ctaObserver.observe(hero);
    },

    _initSmoothScroll() {
        this.el.querySelectorAll('a[href^="#mv-"]').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(a.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    },
});
