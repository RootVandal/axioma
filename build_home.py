"""Builds the Axioma home page in Russian (/) and English (/en/). Run from the axioma folder."""
import html, json, os

TG = 'https://t.me/nonexxxist'
KEY = 'a1237403-07fb-4b6d-88e4-250b3a159863'   # Web3Forms access key, set by the owner. Do not change.
DEMOS = 'https://rootvandal.github.io/axioma-demos/'

CSP = ("default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; "
       "img-src 'self' data:; connect-src https://api.web3forms.com; base-uri 'none'; form-action 'none'; object-src 'none'")

# url, image, our project?
WORKS = [
    ('https://rootvandal.github.io/zen/', 'zen', True),
    ('https://kenyfn.github.io/planet-preview/', 'planet', True),
    ('https://rootvandal.github.io/noir-detailing/', 'noir', False),
    ('/space/', 'space', True),
    (DEMOS + 'lumen/', 'lumen', False),
    (DEMOS + 'coffee/', 'coffee', False),
    (DEMOS + 'build/', 'build', False),
]

T = {
 'ru': dict(
    title='Axioma — создание сайтов для бизнеса в Алматы',
    desc='Студия Axioma создаёт сайты для бизнеса: лендинги, сайты компаний, интернет-магазины. Алматы, Казахстан, СНГ и весь мир. Посмотрите наши работы и напишите нам.',
    nav=[('#work', 'Работы'), ('#services', 'Что делаем'), ('#process', 'Как работаем'), ('#faq', 'Вопросы')],
    tg='Написать в Telegram', tgShort='Telegram', other=('/en/', 'EN', 'English version'), cur='RU',
    eyebrow='Студия сайтов · Алматы',
    h1='Сайты, на которые', h1em='приятно смотреть',
    ticker=['Лендинги', 'Сайты компаний', 'Интернет-магазины', '3D-сайты', 'Каталоги', 'Портфолио', 'Сайты для рекламы'],
    band='Есть идея для сайта?', bandP='Расскажите о ней в двух словах, а мы предложим, как её воплотить.', count='7 живых работ',
    lead='Делаем лендинги, сайты компаний и интернет-магазины. Работаем с клиентами из Казахстана, СНГ и других стран. Стоимость и сроки обсуждаем под вашу задачу.',
    seeWork='Смотреть работы', discuss='Обсудить проект',
    facts=['Сайт удобно смотреть на телефоне и компьютере', 'Каждую работу можно открыть и полистать', 'Общаемся в Telegram или по телефону'],
    workK='Портфолио', workH='Наши работы', workP='Наши проекты и демо-сайты для разных видов бизнеса. Нажмите на карточку, чтобы открыть сайт.',
    open='Открыть сайт', ours='Наш проект', demo='Демо, компания вымышлена',
    works={
     'zen': ('ZEN', 'Сайт-портфолио студии', 'Тёмная японская эстетика: красное солнце, самурай и горы, которые оживают при прокрутке.'),
     'planet': ('PLANET', 'Сайт веб-студии', 'Светлый сайт с вишнёвым деревом, которое растёт при прокрутке. Услуги, этапы работы, вопросы и форма заявки.'),
     'noir': ('NOIR Detailing', 'Сайт детейлинг-студии', 'Строгий чёрно-белый стиль автомобильного журнала, калькулятор стоимости и галереи работ.'),
     'space': ('Axioma Space', '3D-сайт', 'Космическое путешествие в браузере: корабль, галактика и чёрная дыра. Сцены и музыка создаются в реальном времени.'),
     'lumen': ('Lumen', 'Интернет-магазин украшений', 'Спокойная типографика и золото на тёплом фоне. Каталог по категориям, корзина и рассказ о мастерской.'),
     'coffee': ('Bloom Coffee', 'Лендинг кофейни', 'Тёплый первый экран, меню с фото и фильтром, часы работы и как найти кофейню.'),
     'build': ('Qala Build', 'Сайт строительной компании', 'Дома под ключ: услуги, сданные объекты, этапы работы и заявка на расчёт сметы.'),
    },
    svcK='Услуги', svcH='Что мы делаем',
    svc=[('Лендинг', 'Одна страница для товара, услуги или акции. Подходит для рекламы: человек сразу видит главное и оставляет заявку.'),
         ('Сайт компании', 'Несколько страниц: услуги, о компании, работы, контакты. Помогает клиентам узнать вас и связаться.'),
         ('Интернет-магазин или каталог', 'Товары по категориям, карточки с фото, корзина или запрос цены.'),
         ('Сайт с 3D и анимацией', 'Для тех, кто хочет выделиться: живой первый экран, который запоминается.')],
    svcNote='Цену называем после короткого разговора о задаче: она зависит от объёма работы. Напишите нам, это ни к чему не обязывает.',
    procK='Процесс', procH='Как мы работаем',
    proc=[('Знакомимся', 'Вы пишете в Telegram или оставляете заявку. Расспрашиваем о бизнесе и о том, какой сайт нужен.'),
          ('Договариваемся', 'Называем стоимость и срок. Согласуем, из каких разделов будет состоять сайт.'),
          ('Делаем', 'Готовим дизайн и собираем сайт. Показываем результат и вносим правки.'),
          ('Запускаем', 'Проверяем сайт на телефоне и компьютере и публикуем его.')],
    faqK='Вопросы', faqH='Частые вопросы',
    faq=[('Сколько стоит сайт?', 'Зависит от задачи: сколько страниц, есть ли каталог, нужна ли анимация. Расскажите, что вам нужно, и мы назовём точную цену до начала работы.'),
         ('Сколько времени занимает работа?', 'Срок зависит от объёма. Мы называем его заранее, вместе с ценой.'),
         ('Что нужно от меня?', 'Рассказать о бизнесе и прислать тексты и фото, если они есть. Если чего-то нет, подскажем, как быть.'),
         ('Вы работаете только в Алматы?', 'Нет. Мы находимся в Алматы, но работаем удалённо с клиентами из Казахстана, СНГ и других стран.'),
         ('Сайт будет работать на телефоне?', 'Да. Каждый сайт мы проверяем на телефоне и компьютере.')],
    cK='Контакты', cH='Расскажите о вашем проекте',
    cP='Оставьте заявку, и мы свяжемся с вами. Или напишите сразу в Telegram.',
    name='Имя', phone='Телефон', email='Почта', wish='Что нужно сделать (необязательно)',
    consent='Я согласен на обработку персональных данных согласно', privacy='политике конфиденциальности', privacyUrl='/privacy/',
    send='Отправить заявку', sending='Отправляем…',
    errName='Введите имя', errPhone='Введите корректный номер', errEmail='Введите корректную почту', errConsent='Подтвердите согласие',
    errSend='Не удалось отправить. Попробуйте ещё раз или напишите в Telegram.', ok='Спасибо, заявка отправлена! Мы скоро с вами свяжемся.',
    orTg='Удобнее в мессенджере?', foot='Студия сайтов в Алматы. Работаем по Казахстану, СНГ и всему миру.', privacyFoot='Политика конфиденциальности',
    menu='Меню', hreflang='ru', path='/',
 ),
 'en': dict(
    title='Axioma — website design and development in Almaty',
    desc='Axioma builds websites for business: landing pages, company websites and online stores. Based in Almaty, working with clients worldwide. See our work and get in touch.',
    nav=[('#work', 'Work'), ('#services', 'Services'), ('#process', 'Process'), ('#faq', 'FAQ')],
    tg='Message on Telegram', tgShort='Telegram', other=('/', 'RU', 'Русская версия'), cur='EN',
    eyebrow='Website studio · Almaty',
    h1='Websites that are', h1em='a pleasure to look at',
    ticker=['Landing pages', 'Company websites', 'Online stores', '3D websites', 'Catalogs', 'Portfolios', 'Ad campaign pages'],
    band='Have an idea for a website?', bandP='Tell us about it in a couple of words and we will suggest how to bring it to life.', count='7 live projects',
    lead='We build landing pages, company websites and online stores for clients in Kazakhstan, the CIS and around the world. Price and timeline are agreed for your specific project.',
    seeWork='See our work', discuss='Discuss a project',
    facts=['Easy to view on phones and computers', 'Every project below is live: open it and look around', 'We talk on Telegram or by phone'],
    workK='Portfolio', workH='Our work', workP='Our own projects and demo sites for different kinds of business. Click a card to open the site.',
    open='Open site', ours='Our project', demo='Demo, fictional company',
    works={
     'zen': ('ZEN', 'Studio portfolio site', 'Dark Japanese aesthetics: a red sun, a samurai and mountains that come alive as you scroll.'),
     'planet': ('PLANET', 'Web studio website', 'A bright site with a cherry tree that grows as you scroll. Services, process, FAQ and a request form.'),
     'noir': ('NOIR Detailing', 'Car detailing studio', 'The strict black-and-white style of a car magazine, a price calculator and project galleries.'),
     'space': ('Axioma Space', '3D website', 'A space journey in the browser: a ship, a galaxy and a black hole. Scenes and music are generated in real time.'),
     'lumen': ('Lumen', 'Jewelry online store', 'Calm typography and gold on a warm background. A catalog by category, a cart and a story about the workshop.'),
     'coffee': ('Bloom Coffee', 'Coffee shop landing page', 'A warm first screen, a menu with photos and a filter, opening hours and directions.'),
     'build': ('Qala Build', 'Construction company website', 'Turnkey houses: services, completed projects, the work process and a quote request.'),
    },
    svcK='Services', svcH='What we do',
    svc=[('Landing page', 'One page for a product, service or offer. Great for ads: visitors see the essentials right away and leave a request.'),
         ('Company website', 'Several pages: services, about, portfolio, contacts. Helps customers get to know you and get in touch.'),
         ('Online store or catalog', 'Products by category, cards with photos, a cart or a price request.'),
         ('Website with 3D and animation', 'For those who want to stand out: a living first screen people remember.')],
    svcNote='We quote a price after a short talk about your project, since it depends on the scope. Message us, there is no obligation.',
    procK='Process', procH='How we work',
    proc=[('Get to know you', 'You message us on Telegram or send a request. We ask about your business and the site you need.'),
          ('Agree', 'We give you the price and timeline and agree on the sections of the site.'),
          ('Build', 'We design and build the site, show you the result and make your edits.'),
          ('Launch', 'We check the site on phones and computers and publish it.')],
    faqK='FAQ', faqH='Frequently asked questions',
    faq=[('How much does a website cost?', 'It depends on the project: how many pages, whether there is a catalog, whether you want animation. Tell us what you need and we will give you an exact price before we start.'),
         ('How long does it take?', 'It depends on the scope. We tell you the timeline in advance, together with the price.'),
         ('What do you need from me?', 'Tell us about your business and send texts and photos if you have them. If something is missing, we will suggest what to do.'),
         ('Do you only work in Almaty?', 'No. We are based in Almaty and work remotely with clients from Kazakhstan, the CIS and other countries.'),
         ('Will the site work on phones?', 'Yes. We check every site on phones and computers.')],
    cK='Contact', cH='Tell us about your project',
    cP='Send a request and we will get back to you. Or message us on Telegram right away.',
    name='Name', phone='Phone', email='Email', wish='What do you need (optional)',
    consent='I agree to the processing of my personal data under the', privacy='privacy policy', privacyUrl='/en/privacy/',
    send='Send request', sending='Sending…',
    errName='Enter your name', errPhone='Enter a valid phone number', errEmail='Enter a valid email', errConsent='Please confirm your consent',
    errSend='Could not send. Please try again or message us on Telegram.', ok='Thank you, your request has been sent! We will be in touch soon.',
    orTg='Prefer a messenger?', foot='Website studio in Almaty. Working with clients across Kazakhstan, the CIS and worldwide.', privacyFoot='Privacy policy',
    menu='Menu', hreflang='en', path='/en/',
 ),
}

e = html.escape
ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11 11 5M6 5h5v5"/></svg>'
TGICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.5 4.2 2.9 11.4c-1.3.5-1.3 1.2-.2 1.5l4.8 1.5 1.8 5.6c.2.6.1.9.8.9.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.2-15c.3-1.3-.5-1.9-1.6-1.4zM8.3 14l9.9-6.3c.5-.3.9-.1.5.2l-8.4 7.6-.3 3.6z"/></svg>'


def page(lang):
    c = T[lang]
    works = ''
    for n, (url, key, ours) in enumerate(WORKS):
        name, kind, text = c['works'][key]
        badge = c['ours'] if ours else c['demo']
        works += (f'<a class="work w-{key} reveal" href="{url}" target="_blank" rel="noopener">'
                  f'<span class="shot"><img src="/img/work-{key}.jpg" alt="{e(name)}: {e(kind)}" width="960" height="600" loading="lazy"></span>'
                  f'<span class="meta"><span class="top-line"><span class="kind">{e(kind)}</span><span class="idx">0{n + 1}</span></span>'
                  f'<span class="name">{e(name)}</span><span class="text">{e(text)}</span>'
                  f'<span class="foot"><span class="badge{" ours" if ours else ""}">{e(badge)}</span><span class="go">{c["open"]} {ARROW}</span></span></span></a>')
    icons = [
        '<svg viewBox="0 0 32 32"><rect x="5" y="4" width="22" height="24" rx="3"/><path d="M10 10h12M10 15h12M10 20h7"/></svg>',
        '<svg viewBox="0 0 32 32"><rect x="3" y="6" width="26" height="20" rx="3"/><path d="M3 11h26M8 16h7v6H8zM19 16h5M19 20h5"/></svg>',
        '<svg viewBox="0 0 32 32"><path d="M6 9h20l-2 15H8z"/><path d="M12 9V7a4 4 0 0 1 8 0v2"/></svg>',
        '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="7"/><ellipse cx="16" cy="16" rx="13" ry="4" transform="rotate(-18 16 16)"/></svg>',
    ]
    svc = ''.join(f'<div class="card reveal">{icons[i]}<h3>{e(a)}</h3><p>{e(b)}</p></div>' for i, (a, b) in enumerate(c['svc']))
    proc = ''.join(f'<li class="reveal"><span class="num">0{i + 1}</span><h3>{e(a)}</h3><p>{e(b)}</p></li>' for i, (a, b) in enumerate(c['proc']))
    faq = ''.join(f'<details><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in c['faq'])
    facts = ''.join(f'<li>{e(x)}</li>' for x in c['facts'])
    tick = ''.join(f'<span>{e(x)}</span><i>✦</i>' for x in c['ticker'])
    nav = ''.join(f'<a href="{h}">{e(t)}</a>' for h, t in c['nav'])
    other, otherLabel, otherTitle = c['other']
    msgs = {k: c[k] for k in ('errName', 'errPhone', 'errEmail', 'errConsent', 'errSend', 'ok', 'sending', 'send')}
    ld = {"@context": "https://schema.org", "@type": "ProfessionalService", "name": "Axioma", "url": "https://axioma.codes" + c['path'],
          "description": c['desc'], "logo": "https://axioma.codes/img/logo.svg", "image": "https://axioma.codes/og.png",
          "address": {"@type": "PostalAddress", "addressLocality": "Almaty", "addressCountry": "KZ"}, "areaServed": "Worldwide", "sameAs": [TG]}
    faqld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in c['faq']]}
    return f"""<!doctype html>
<html lang="{lang}" class="nojs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#0b0b10">
<title>{e(c['title'])}</title>
<meta name="description" content="{e(c['desc'])}">
<link rel="canonical" href="https://axioma.codes{c['path']}">
<link rel="alternate" hreflang="ru" href="https://axioma.codes/">
<link rel="alternate" hreflang="en" href="https://axioma.codes/en/">
<link rel="alternate" hreflang="x-default" href="https://axioma.codes/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Axioma">
<meta property="og:title" content="{e(c['title'])}">
<meta property="og:description" content="{e(c['desc'])}">
<meta property="og:url" content="https://axioma.codes{c['path']}">
<meta property="og:image" content="https://axioma.codes/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@300;400;500;600&family=Unbounded:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/home.css?v=VER">
<script src="/js/home.js?v=VER" defer></script>
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<script type="application/ld+json">{json.dumps(faqld, ensure_ascii=False)}</script>
</head>
<body>
<div class="aurora" aria-hidden="true"><i class="a1"></i><i class="a2"></i><i class="a3"></i></div>
<canvas id="stars" aria-hidden="true"></canvas><div class="glow" aria-hidden="true"></div>
<header class="top"><div class="wrap">
  <a class="logo" href="{c['path']}" aria-label="Axioma"><img src="/img/logo.svg" alt="Axioma" width="132" height="25"></a>
  <nav class="nav" id="nav">{nav}</nav>
  <div class="actions">
    <a class="lang" href="{other}" hreflang="{'en' if lang == 'ru' else 'ru'}" title="{otherTitle}">{otherLabel}</a>
    <a class="btn small" href="{TG}" target="_blank" rel="noopener">{TGICON}<span>{c['tgShort']}</span></a>
    <button class="burger" type="button" aria-controls="nav" aria-expanded="false" aria-label="{c['menu']}"><i></i><i></i></button>
  </div>
</div></header>

<main>
<section class="hero"><div class="wrap">
  <div class="hero-txt">
    <p class="eyebrow"><span class="dot"></span>{c['eyebrow']}</p>
    <h1>{e(c['h1'])} <em>{e(c['h1em'])}</em></h1>
    <p class="lead">{e(c['lead'])}</p>
    <div class="cta"><a class="btn" href="#work">{c['seeWork']} <span class="arr">↓</span></a><a class="btn ghost" href="#request">{c['discuss']}</a></div>
    <ul class="facts">{facts}</ul>
  </div>
  <div class="fan" aria-hidden="true">
    <span class="ring back"></span><span class="planet"></span><span class="ring front"></span><span class="moon"></span>
    <div class="fan-in">
      <img class="f1" src="/img/work-lumen.jpg" alt="" width="960" height="600">
      <img class="f2" src="/img/work-zen.jpg" alt="" width="960" height="600">
      <img class="f3" src="/img/work-planet.jpg" alt="" width="960" height="600">
    </div>
    <span class="chip">{c['count']}</span>
  </div>
</div></section>

<div class="ticker" aria-hidden="true"><div class="tick-in">{tick}{tick}</div></div>

<section id="work" class="sec"><div class="wrap">
  <div class="head reveal"><p class="eyebrow">{c['workK']}</p><h2>{c['workH']}</h2><p class="sub">{e(c['workP'])}</p></div>
  <div class="works">{works}</div>
</div></section>

<section id="services" class="sec"><div class="wrap">
  <div class="head reveal"><p class="eyebrow">{c['svcK']}</p><h2>{c['svcH']}</h2></div>
  <div class="cards">{svc}</div>
  <p class="note reveal">{e(c['svcNote'])} <a href="#request">{c['discuss']} →</a></p>
</div></section>

<section id="process" class="sec"><div class="wrap">
  <div class="head reveal"><p class="eyebrow">{c['procK']}</p><h2>{c['procH']}</h2></div>
  <ol class="steps">{proc}</ol>
</div></section>

<section id="faq" class="sec"><div class="wrap split">
  <div class="head reveal"><p class="eyebrow">{c['faqK']}</p><h2>{c['faqH']}</h2></div>
  <div class="faq reveal">{faq}</div>
</div></section>

<section class="band"><div class="wrap reveal">
  <h2>{e(c['band'])}</h2><p>{e(c['bandP'])}</p>
  <div class="cta"><a class="btn" href="#request">{c['discuss']}</a><a class="btn tg" href="{TG}" target="_blank" rel="noopener">{TGICON}<span>{c['tg']}</span></a></div>
</div></section>

<section id="request" class="sec"><div class="wrap contact">
  <div class="head reveal">
    <p class="eyebrow">{c['cK']}</p><h2>{c['cH']}</h2><p class="sub">{e(c['cP'])}</p>
    <div class="tgcard"><p>{c['orTg']}</p><a class="btn tg" href="{TG}" target="_blank" rel="noopener">{TGICON}<span>{c['tg']}</span></a><span class="handle">@nonexxxist</span></div>
  </div>
  <form id="apply" class="form reveal" novalidate data-key="{KEY}" data-msgs='{e(json.dumps(msgs, ensure_ascii=False))}'>
    <label class="trap" aria-hidden="true">botcheck<input type="checkbox" name="botcheck" tabindex="-1" autocomplete="off"></label>
    <div class="field"><label for="f-name">{c['name']}</label><input id="f-name" name="name" required maxlength="80" autocomplete="name"><span class="err" role="alert"></span></div>
    <div class="row">
      <div class="field"><label for="f-phone">{c['phone']}</label><input id="f-phone" name="phone" type="tel" required maxlength="20" autocomplete="tel" inputmode="tel"><span class="err" role="alert"></span></div>
      <div class="field"><label for="f-email">{c['email']}</label><input id="f-email" name="email" type="email" required maxlength="120" autocomplete="email"><span class="err" role="alert"></span></div>
    </div>
    <div class="field"><label for="f-msg">{c['wish']}</label><textarea id="f-msg" name="message" rows="4" maxlength="1500"></textarea></div>
    <div class="field consent"><label><input type="checkbox" name="consent" required> <span>{c['consent']} <a href="{c['privacyUrl']}">{c['privacy']}</a></span></label><span class="err" role="alert"></span></div>
    <button class="btn wide" type="submit">{c['send']}</button>
    <p class="status" id="apply-status" role="status"></p>
  </form>
</div></section>
</main>

<footer class="bottom"><div class="wrap">
  <img src="/img/logo.svg" alt="Axioma" width="110" height="21">
  <p>{c['foot']}</p>
  <p class="links"><a href="{TG}" target="_blank" rel="noopener">Telegram</a><a href="{c['privacyUrl']}">{c['privacyFoot']}</a><a href="{other}">{otherTitle}</a></p>
  <p class="copy">© 2026 Axioma</p>
</div></footer>
</body>
</html>
"""


if __name__ == '__main__':
    import hashlib
    ver = hashlib.sha1((open('css/home.css', 'rb').read() + open('js/home.js', 'rb').read())).hexdigest()[:10]
    for lang, out in (('ru', 'index.html'), ('en', 'en/index.html')):
        os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
        open(out, 'w', encoding='utf8', newline='\n').write(page(lang).replace('VER', ver))
    print('home pages built', ver)
