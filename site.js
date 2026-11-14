/* Tradeworks Digital — shared behaviour (redesign, Oct 2026). No libraries. */
(function () {
  var doc = document.documentElement;
  doc.classList.remove('no-js');
  doc.classList.add('js');

  // iPhones only show :active (the button press effect) when a touch listener exists.
  document.addEventListener('touchstart', function () {}, { passive: true });

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Mobile menu ---------- */
  var menuBtn = document.querySelector('.sh-menu');
  var menu = document.getElementById('site-menu');
  function setMenu(open) {
    if (!menuBtn || !menu) return;
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.classList.toggle('is-open', open);
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () {
      setMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        menuBtn.focus();
      }
    });
  }

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll('.reveal, .reveal-stagger');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    // Anything already on screen shows straight away (no flicker), the rest rises in.
    revealEls.forEach(function (el) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) el.classList.add('is-in');
    });
    doc.classList.add('reveal-ready');
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          ro.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    revealEls.forEach(function (el) { if (!el.classList.contains('is-in')) ro.observe(el); });
  }

  /* ---------- Pause looping animations while their section is off screen (saves battery) ---------- */
  if ('IntersectionObserver' in window) {
    var po = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { entry.target.classList.toggle('is-offscreen', !entry.isIntersecting); });
    });
    document.querySelectorAll('[data-pause-offscreen]').forEach(function (el) { po.observe(el); });
  }

  /* ---------- Count-up numbers: <span data-count="397" data-prefix="£">£397</span> ---------- */
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var from = parseFloat(el.getAttribute('data-from') || '0');
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var start = null, dur = 1300;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(from + (target - from) * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll('[data-count]');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { countUp(entry.target); co.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { co.observe(el); });
  }

  /* ---------- Mobile booking bar: appears after the first screen, hides near the booking section ---------- */
  var bar = document.querySelector('.m-cta');
  if (bar) {
    var book = document.getElementById('book');
    var bookVisible = false;
    function update() {
      var past = window.scrollY > window.innerHeight * 0.6;
      bar.classList.toggle('is-shown', past && !bookVisible);
    }
    if (book && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        bookVisible = entries[0].isIntersecting;
        update();
      }, { rootMargin: '0px 0px -20% 0px' }).observe(book);
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ---------- Enquiry form -> your CRM (Twenty webhook or relay), sent as JSON ---------- */
  var form = document.querySelector('form[data-enquiry]');
  var formShownAt = Date.now();
  if (form && window.fetch) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = form.querySelector('[data-form-status]');
      var btn = form.querySelector('button[type="submit"]');
      status.hidden = true;
      if (!form.checkValidity()) {
        status.textContent = 'Please add your name, email and a few lines about what you need.';
        status.hidden = false;
        return;
      }
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = String(v).trim(); });
      if (data.website) return; // spam trap: real people never see or fill this field
      delete data.website;
      if (data.service) { data.message = 'Service: ' + data.service + '\n\n' + (data.message || ''); delete data.service; } // the CRM relay keeps the message, so the choice travels inside it
      data.elapsed_ms = Date.now() - formShownAt; // the relay ignores forms filled in under 3 seconds (bots)
      if (form.getAttribute('action').indexOf('CRM_ENQUIRY_URL') !== -1) {
        status.textContent = 'This form isn\u2019t connected yet. Please email mosa@tradeworksdigital.co.uk instead.';
        status.hidden = false;
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Sending\u2026';
      fetch(form.getAttribute('action'), { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } })
        .then(function (res) {
          if (!res.ok) throw new Error('bad');
          form.hidden = true;
          var done = document.querySelector('[data-form-done]');
          if (done) { done.hidden = false; done.focus(); }
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = 'Send Message';
          status.textContent = 'Something went wrong sending that. Please try again, or email mosa@tradeworksdigital.co.uk.';
          status.hidden = false;
        });
    });
  }
  /* ---------- Newsletter sign-up (footer) -> relay -> listmonk (sends the confirm email) + Twenty ---------- */
  var subShownAt = Date.now();
  Array.prototype.forEach.call(document.querySelectorAll('form[data-subscribe]'), function (sub) {
    if (!window.fetch) return;
    sub.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = sub.querySelector('[data-subscribe-status]');
      var btn = sub.querySelector('button[type="submit"]');
      var email = sub.querySelector('input[type="email"]');
      if (!email.checkValidity() || !email.value.trim()) {
        status.textContent = 'Please enter your email address.';
        status.hidden = false;
        email.focus();
        return;
      }
      var data = {};
      new FormData(sub).forEach(function (v, k) { data[k] = String(v).trim(); });
      if (data.website) return; // spam trap
      delete data.website;
      data.elapsed_ms = Date.now() - subShownAt;
      btn.disabled = true;
      btn.textContent = 'Signing you up\u2026';
      fetch(sub.getAttribute('action'), { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } })
        .then(function (res) {
          if (!res.ok) throw new Error('bad');
          email.hidden = true;
          btn.hidden = true;
          status.textContent = 'Nearly done: check your inbox and click the link to confirm.';
          status.hidden = false;
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = 'Sign Me Up';
          status.textContent = 'That didn\u2019t go through. Please try again in a minute.';
          status.hidden = false;
        });
    });
  });

  // Work tabs (homepage: Case studies / Blog). Arrow keys move between tabs.
  var tablists = document.querySelectorAll('[role="tablist"]');
  Array.prototype.forEach.call(tablists, function (list) {
    var tabs = list.querySelectorAll('[role="tab"]');
    function select(tab, focus) {
      Array.prototype.forEach.call(tabs, function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    }
    Array.prototype.forEach.call(tabs, function (tab, i) {
      tab.addEventListener('click', function () { select(tab, false); });
      tab.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === 'Home') n = tabs[0];
        if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
  });
})();
