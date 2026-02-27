/* Premium Main JS */
document.addEventListener('DOMContentLoaded', function() {

    // Mobile Navigation
    var navToggle = document.querySelector('.nav-toggle');
    var navMenu = document.querySelector('.nav-menu');

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            navToggle.classList.toggle('active');
            var expanded = navToggle.getAttribute('aria-expanded') === 'true';
            navToggle.setAttribute('aria-expanded', String(!expanded));
        });

        var navLinks = navMenu.querySelectorAll('a');
        navLinks.forEach(function(link) {
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
            if (window.scrollY > 10) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // Active nav link
    var currentPage = window.location.pathname.split('/').pop() || 'index.html';
    var allNavLinks = document.querySelectorAll('.nav-link');
    allNavLinks.forEach(function(link) {
        link.classList.remove('active');
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });

    // Intersection Observer for scroll animations
    var animateElements = document.querySelectorAll('.animate-in');
    if (animateElements.length > 0 && 'IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

        animateElements.forEach(function(el) {
            observer.observe(el);
        });
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
                    var duration = 2000;
                    var startTime = null;

                    function animate(timestamp) {
                        if (!startTime) startTime = timestamp;
                        var progress = Math.min((timestamp - startTime) / duration, 1);
                        var eased = 1 - Math.pow(1 - progress, 3);
                        var current = Math.floor(eased * target);
                        el.textContent = current + suffix;
                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        }
                    }
                    requestAnimationFrame(animate);
                    counterObserver.unobserve(el);
                }
            });
        }, { threshold: 0.5 });

        statNumbers.forEach(function(el) {
            counterObserver.observe(el);
        });
    }

    // Form validation with inline errors
    var rfqForm = document.getElementById('rfqForm');
    if (rfqForm) {
        rfqForm.addEventListener('submit', function(e) {
            var nameInput = document.getElementById('name');
            var emailInput = document.getElementById('email');
            var messageInput = document.getElementById('message');
            var nameError = document.getElementById('name-error');
            var emailError = document.getElementById('email-error');
            var messageError = document.getElementById('message-error');
            var hasError = false;

            // Clear previous errors
            [nameInput, emailInput, messageInput].forEach(function(input) {
                if (input) input.classList.remove('error');
            });
            [nameError, emailError, messageError].forEach(function(err) {
                if (err) err.textContent = '';
            });

            if (nameInput && !nameInput.value.trim()) {
                nameInput.classList.add('error');
                if (nameError) nameError.textContent = 'Please enter your full name.';
                hasError = true;
            }

            if (emailInput) {
                if (!emailInput.value.trim()) {
                    emailInput.classList.add('error');
                    if (emailError) emailError.textContent = 'Please enter your email address.';
                    hasError = true;
                } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) {
                    emailInput.classList.add('error');
                    if (emailError) emailError.textContent = 'Please enter a valid email address.';
                    hasError = true;
                }
            }

            if (messageInput && !messageInput.value.trim()) {
                messageInput.classList.add('error');
                if (messageError) messageError.textContent = 'Please enter a message.';
                hasError = true;
            }

            if (hasError) {
                e.preventDefault();
                var firstError = rfqForm.querySelector('.error');
                if (firstError) firstError.focus();
            }
        });
    }

    // RSS News Feed
    var newsGrid = document.getElementById('newsGrid');
    if (newsGrid) {
        loadNewsFeed(newsGrid);
    }

});

// RSS Feed loader
function loadNewsFeed(container) {
    // 6 Google News RSS searches targeting metal 3D printing specifically
    var feeds = [
        { url: 'https://news.google.com/rss/search?q=metal+3d+printing+additive+manufacturing&hl=en-US&gl=US&ceid=US:en', name: 'Google News' },
        { url: 'https://news.google.com/rss/search?q=DMLS+SLM+metal+printing&hl=en-US&gl=US&ceid=US:en', name: 'Google News' },
        { url: 'https://news.google.com/rss/search?q=metal+powder+bed+fusion+aerospace&hl=en-US&gl=US&ceid=US:en', name: 'Google News' },
        { url: 'https://news.google.com/rss/search?q=metal+additive+manufacturing+titanium+inconel&hl=en-US&gl=US&ceid=US:en', name: 'Google News' },
        { url: 'https://www.metal-am.com/feed/', name: 'Metal AM Magazine' },
        { url: 'https://3dprintingindustry.com/feed/', name: '3D Printing Industry' }
    ];

    var rss2jsonBase = 'https://api.rss2json.com/v1/api.json?rss_url=';
    var allArticles = [];
    var feedsLoaded = 0;
    var feedsTotal = feeds.length;

    // Timeout: show fallback if feeds don't all load within 8 seconds
    var timeout = setTimeout(function() {
        if (feedsLoaded < feedsTotal) {
            renderNews(container, allArticles);
        }
    }, 8000);

    feeds.forEach(function(feed) {
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var fetchOptions = controller ? { signal: controller.signal } : {};
        var feedTimeout = setTimeout(function() {
            if (controller) controller.abort();
        }, 6000);

        fetch(rss2jsonBase + encodeURIComponent(feed.url), fetchOptions)
            .then(function(res) { return res.json(); })
            .then(function(data) {
                clearTimeout(feedTimeout);
                if (data.status === 'ok' && data.items) {
                    data.items.forEach(function(item) {
                        allArticles.push({
                            title: item.title,
                            link: item.link,
                            description: stripHtml(item.description).substring(0, 150) + '...',
                            pubDate: item.pubDate,
                            thumbnail: item.thumbnail || (item.enclosure && item.enclosure.link) || '',
                            source: feed.name
                        });
                    });
                }
            })
            .catch(function() {
                clearTimeout(feedTimeout);
            })
            .then(function() {
                feedsLoaded++;
                if (feedsLoaded === feedsTotal) {
                    clearTimeout(timeout);
                    renderNews(container, allArticles);
                }
            });
    });
}

function stripHtml(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

function renderNews(container, articles) {
    if (articles.length === 0) {
        container.innerHTML = '<div class="news-error"><p>Unable to load news feeds at this time.</p><a href="https://3dprintingindustry.com" target="_blank" rel="noopener" class="btn btn-outline">Visit 3D Printing Industry</a></div>';
        return;
    }

    // Sort by date (newest first) and take top 6
    articles.sort(function(a, b) {
        return new Date(b.pubDate) - new Date(a.pubDate);
    });
    var top = articles.slice(0, 6);

    // Fallback images used when article has no thumbnail (Google News RSS never includes thumbnails)
    var fallbackImgs = [
        'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&q=70',
        'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=400&q=70',
        'https://images.unsplash.com/photo-1621570169561-7dbc795766e5?w=400&q=70',
        'https://images.unsplash.com/photo-1581091226033-d5c48150dbaa?w=400&q=70',
        'https://images.unsplash.com/photo-1617802690992-15d93263d3a9?w=400&q=70',
        'https://images.unsplash.com/photo-1735547577700-0fdeef45eef6?w=400&q=70'
    ];

    var html = '';
    top.forEach(function(article, i) {
        var date = new Date(article.pubDate);
        var dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        var imgSrc = article.thumbnail || fallbackImgs[i % fallbackImgs.length];
        var nextFallback = fallbackImgs[(i + 1) % fallbackImgs.length];
        var imageHtml = '<img src="' + imgSrc + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + nextFallback + '\'">';

        html += '<div class="news-card animate-in">' +
            '<div class="news-card-image">' + imageHtml + '</div>' +
            '<div class="news-card-body">' +
                '<div class="news-card-source">' + escapeHtml(article.source) + '</div>' +
                '<h3>' + escapeHtml(article.title) + '</h3>' +
                '<p>' + escapeHtml(article.description) + '</p>' +
                '<div class="news-card-date">' + dateStr + '</div>' +
            '</div>' +
        '</div>';
    });

    container.innerHTML = html;

    // Re-observe new elements for animation
    var newCards = container.querySelectorAll('.animate-in');
    if (newCards.length > 0 && 'IntersectionObserver' in window) {
        var obs = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        newCards.forEach(function(el) { obs.observe(el); });
    }

    // Make entire card clickable
    var cards = container.querySelectorAll('.news-card');
    cards.forEach(function(card, i) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', function() {
            window.open(top[i].link, '_blank', 'noopener');
        });
    });
}

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}