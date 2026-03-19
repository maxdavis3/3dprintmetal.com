/* ============================================
   PrintWire Theme — Main JS
   ============================================ */
document.addEventListener('DOMContentLoaded', function() {

  // Mobile Navigation
  var navToggle = document.querySelector('.nav-toggle');
  var navMenu   = document.querySelector('.nav-menu');
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function() {
      navMenu.classList.toggle('active');
      navToggle.classList.toggle('active');
      var expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!expanded));
    });
    navMenu.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        navMenu.classList.remove('active');
        navToggle.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('click', function(e) {
      if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
        navMenu.classList.remove('active');
        navToggle.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Header scroll effect
  var header = document.querySelector('.site-header');
  if (header) {
    window.addEventListener('scroll', function() {
      header.classList.toggle('scrolled', window.scrollY > 10);
    });
  }

  // Intersection Observer for scroll animations
  var animateEls = document.querySelectorAll('.animate-in');
  if (animateEls.length > 0 && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    animateEls.forEach(function(el) { observer.observe(el); });
  }

  // Counter animation for stat numbers
  var statNumbers = document.querySelectorAll('.stat-number[data-count]');
  if (statNumbers.length > 0 && 'IntersectionObserver' in window) {
    var counterObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          var target = parseInt(el.getAttribute('data-count'), 10);
          var suffix = el.textContent.replace(/[0-9]/g, '');
          var startTime = null;
          function animate(ts) {
            if (!startTime) startTime = ts;
            var p = Math.min((ts - startTime) / 2000, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.floor(eased * target) + suffix;
            if (p < 1) requestAnimationFrame(animate);
          }
          requestAnimationFrame(animate);
          counterObserver.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    statNumbers.forEach(function(el) { counterObserver.observe(el); });
  }

  // Contact / newsletter forms — Web3Forms
  var forms = document.querySelectorAll('#rfqForm, #contact-form, #advertise-form, #newsletter-form');
  forms.forEach(function(form) {
    var msgEl = form.querySelector('.form-message');
    if (!msgEl) {
      msgEl = document.createElement('div');
      msgEl.className = 'form-message';
      form.insertBefore(msgEl, form.firstChild);
    }
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      msgEl.textContent = ''; msgEl.className = 'form-message';
      var nameEl    = form.querySelector('[name="name"]');
      var emailEl   = form.querySelector('[name="email"]');
      var messageEl = form.querySelector('[name="message"]');
      var errors = [];
      if (nameEl && !nameEl.value.trim())    errors.push('Please enter your name.');
      if (emailEl) {
        if (!emailEl.value.trim())           errors.push('Please enter your email.');
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim()))
                                             errors.push('Please enter a valid email address.');
      }
      if (messageEl && !messageEl.value.trim()) errors.push('Please enter a message.');
      if (errors.length > 0) {
        msgEl.className = 'form-message error';
        msgEl.innerHTML = errors.join('<br>');
        return;
      }
      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending...'; }
      var formData = new FormData(form);
      if (!formData.get('access_key')) formData.append('access_key', '6f33053b-6d08-414b-9615-665f88c98da8');
      fetch('https://api.web3forms.com/submit', { method: 'POST', body: formData })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send Message'; }
          if (data.success) {
            msgEl.className = 'form-message success';
            msgEl.textContent = 'Thank you! Your message has been sent. We will respond within 24 hours.';
            form.reset();
          } else {
            msgEl.className = 'form-message error';
            msgEl.textContent = 'Error: ' + (data.message || 'Please try again.');
          }
        })
        .catch(function() {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send Message'; }
          msgEl.className = 'form-message error';
          msgEl.textContent = 'Network error. Please check your connection and try again.';
        });
    });
  });

});

/* ============================================
   NEWS FEED — PubMed E-utilities API
   Config read from window.SITE_CONFIG (set in head.html)
   ============================================ */
(function() {
  var container = document.getElementById('news-feed');
  if (!container) return;

  var cfg            = window.SITE_CONFIG || {};
  var query          = (cfg.pubmedQuery    || '3D+printing+additive+manufacturing').replace(/\s+/g, '+');
  var fallbackSearch = (cfg.pubmedFallback || '3D+printing').replace(/\s+/g, '+');
  var fallbackImgs   = cfg.newsFallbackImages || ['images/01.png', 'images/02.png', 'images/03.png'];

  var eutils = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
  container.innerHTML = '<p class="news-loading">Loading latest research...</p>';

  var timeout = setTimeout(function() { renderNews([]); }, 12000);

  fetch(eutils + 'esearch.fcgi?db=pubmed&term=' + query + '&retmax=6&retmode=json&sort=date')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var ids = (data.esearchresult && data.esearchresult.idlist) || [];
      if (ids.length === 0) throw new Error('no results');
      return fetch(eutils + 'esummary.fcgi?db=pubmed&id=' + ids.join(',') + '&retmode=json');
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      clearTimeout(timeout);
      var uids = (data.result && data.result.uids) || [];
      var articles = uids.map(function(uid) {
        var item    = data.result[uid];
        var authors = (item.authors || []).slice(0, 2).map(function(a) { return a.name; }).join(', ');
        var dateStr = (item.pubdate || '').split(' ').slice(0, 2).join(' ');
        return { uid: uid, title: item.title || '', authors: authors, date: dateStr, source: item.source || 'PubMed' };
      }).filter(function(a) { return a.title; });
      renderNews(articles);
    })
    .catch(function() {
      clearTimeout(timeout);
      renderNews([]);
    });

  function renderNews(articles) {
    if (articles.length === 0) {
      container.innerHTML = '<p class="news-loading">See the latest research on <a href="https://pubmed.ncbi.nlm.nih.gov/?term=' + fallbackSearch + '" target="_blank" rel="noopener" style="color:var(--primary-light)">PubMed</a>.</p>';
      return;
    }
    container.innerHTML = '<div class="news-grid">' + articles.slice(0, 3).map(function(a, idx) {
      var img     = fallbackImgs[idx % fallbackImgs.length];
      var excerpt = a.authors ? 'By ' + a.authors + (a.source ? ' &mdash; ' + a.source : '') : a.source;
      return [
        '<div class="news-card">',
          '<div class="news-card-image">',
            '<img src="' + img + '" alt="Research" loading="lazy">',
          '</div>',
          '<div class="news-card-body">',
            '<div class="news-card-meta">' + (a.date || 'Recent') + '</div>',
            '<h3>' + a.title + '</h3>',
            '<p>' + excerpt + '</p>',
            '<a href="https://pubmed.ncbi.nlm.nih.gov/' + a.uid + '/" target="_blank" rel="noopener noreferrer" class="news-link">Read Article &rarr;</a>',
          '</div>',
        '</div>'
      ].join('');
    }).join('') + '</div>';
  }
})();
