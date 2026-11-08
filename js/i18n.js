/** Every word on the page, in both languages. */
const DICT = {
  en: {
    title: 'Axioma — websites people remember', desc: 'Axioma designs and builds websites people remember. Send your request and get a site made for your business.',
    backToStart: 'Axioma, back to start', music: 'Music', musicOn: 'Music on', language: 'Switch language', nudge: 'Scroll', svc: 'Services and prices', consent: 'I agree to the processing of my personal data under the', privacyLink: 'privacy policy', errConsent: 'Please confirm your consent', prices: 'Prices', request: 'Send a request', requestShort: 'Request', loading: 'Loading',
    heroSub: 'We build websites people remember.',
    orderK: 'Structure', orderH: 'From a chaos of ideas to a clear structure.', orderT: 'You bring the task. We shape it into a site: pages, meaning and a clear path from the first screen to the request.',
    shipK: 'Engineering', shipH: 'Your website is a machine.', shipT: 'Every part does a job: pages that load fast, clean code and steady work on any device.',
    originK: 'Identity', originH: 'Every business has its own DNA.', originT: 'No templates. The design grows out of your brand, so nobody else will have a site like yours.',
    energyK: 'Conversion', energyH: 'Visitors are energy.', energyT: 'Ads bring people in, and the site turns them into requests. Every block gathers attention the way these panels gather starlight.',
    holeK: 'Attention', holeH: 'A site people can’t pull away from.', holeT: 'Gravity works online too. A strong first screen draws the visitor in and keeps them to the end.',
    scaleK: 'Visibility', scaleH: 'Over a billion websites. Yours gets noticed.', scaleT: 'Search optimisation, speed and a memorable look set you apart from everyone else in your niche.',
    worldK: 'Adaptive', worldH: 'One site, any shape.', worldT: 'It reshapes itself for a phone, a tablet or a desktop. The form changes, the quality stays.',
    moonK: 'Support', moonH: 'We stay after launch.', moonT: 'Silence after launch\nmeans everything just works.',
    endK: 'Axioma',
    formH: 'Your website request', name: 'Name', phone: 'Phone', email: 'Email', wish: 'Wishes for your site (optional)', send: 'Send request',
    errName: 'Enter your name', errPhone: 'Enter a valid phone number', errEmail: 'Enter a valid email', errSend: 'Something went wrong. Please try again.',
    after: 'Request sent. We’ll be in touch, {name}.', foot: 'Every scene and every note is generated in real time',
    tagA: 'Speed', tagAs: 'Pages load without the wait', tagB: 'Adaptive', tagBs: 'Phone, tablet, desktop', tagC: 'SEO', tagCs: 'Search brings clients to you', tagH: 'Your website', tagHs: 'One in a billion',
    noJs: 'This site needs JavaScript and WebGL2.', noGl: 'This browser can’t run WebGL2, which Axioma needs. Try a different browser.',
  },
  ru: {
    title: 'Axioma — сайты, которые запоминают', desc: 'Axioma проектирует и создаёт запоминающиеся сайты. Отправьте запрос и получите сайт, сделанный под ваш бизнес.',
    backToStart: 'Axioma, в начало', music: 'Музыка', musicOn: 'Музыка вкл', language: 'Сменить язык', nudge: 'Листайте', svc: 'Услуги и цены', consent: 'Я согласен на обработку персональных данных согласно', privacyLink: 'политике конфиденциальности', errConsent: 'Подтвердите согласие', prices: 'Цены', request: 'Оставить заявку', requestShort: 'Заявка', loading: 'Загрузка',
    heroSub: 'Мы создаём сайты, которые запоминают.',
    orderK: 'Структура', orderH: 'Из хаоса идей — чёткая структура.', orderT: 'Вы приносите задачу, мы превращаем её в сайт: страницы, смыслы и понятный путь от первого экрана до заявки.',
    shipK: 'Разработка', shipH: 'Ваш сайт — это машина.', shipT: 'Каждая деталь работает на результат: быстрая загрузка, чистый код и стабильная работа на любом устройстве.',
    originK: 'Айдентика', originH: 'У каждого бизнеса своя ДНК.', originT: 'Никаких шаблонов. Дизайн вырастает из вашего бренда, поэтому такого сайта не будет больше ни у кого.',
    energyK: 'Конверсия', energyH: 'Посетители — это энергия.', energyT: 'Реклама приводит людей, а сайт превращает их в заявки. Каждый блок собирает внимание, как эти панели собирают свет звезды.',
    holeK: 'Внимание', holeH: 'Сайт, от которого не оторваться.', holeT: 'Гравитация работает и в интернете. Сильный первый экран притягивает посетителя и удерживает его до конца.',
    scaleK: 'Заметность', scaleH: 'Больше миллиарда сайтов. Заметят ваш.', scaleT: 'Поисковое продвижение, скорость и запоминающийся образ выделяют вас среди всех в вашей нише.',
    worldK: 'Адаптивность', worldH: 'Один сайт, любая форма.', worldT: 'Он подстраивается под телефон, планшет и компьютер. Форма меняется, качество остаётся.',
    moonK: 'Поддержка', moonH: 'Мы остаёмся и после запуска.', moonT: 'Тишина после запуска\nзначит, что всё работает.',
    endK: 'Axioma',
    formH: 'Ваш запрос на создание сайта', name: 'Имя', phone: 'Телефон', email: 'Почта', wish: 'Пожелания к сайту (необязательно)', send: 'Отправить запрос',
    errName: 'Введите имя', errPhone: 'Введите корректный номер', errEmail: 'Введите корректную почту', errSend: 'Что-то пошло не так. Попробуйте ещё раз.',
    after: 'Запрос отправлен. Мы свяжемся с вами, {name}.', foot: 'Каждая сцена и каждая нота создаются в реальном времени',
    tagA: 'Скорость', tagAs: 'Страницы без ожидания', tagB: 'Адаптив', tagBs: 'Телефон, планшет, компьютер', tagC: 'SEO', tagCs: 'Клиенты находят вас в поиске', tagH: 'Ваш сайт', tagHs: 'Один на миллиард',
    noJs: 'Для этого сайта нужны JavaScript и WebGL2.', noGl: 'Этот браузер не поддерживает WebGL2. Попробуйте другой браузер.',
  },
};

const stored = () => { try { return localStorage.getItem('axioma-lang'); } catch { return null; } };
const asked = new URLSearchParams(location.search).get('lang');
let lang = (asked === 'ru' || asked === 'en') ? asked : stored() || (/^(ru|uk|be|kk)/i.test(navigator.language || '') ? 'ru' : 'en');
const listeners = [];

export const t = k => DICT[lang][k] ?? k;
export const onLang = fn => listeners.push(fn);

export function applyLang() {
  const root = document.documentElement;
  root.lang = lang;
  for (const a of document.querySelectorAll('[data-svc]')) a.href = lang === 'ru' ? '/services/' : '/en/services/';
  for (const a of document.querySelectorAll('[data-privacy]')) a.href = lang === 'ru' ? '/privacy/' : '/en/privacy/';
  document.title = t('title');
  document.querySelector('meta[name=description]').content = t('desc');
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
  for (const el of document.querySelectorAll('[data-t-label]')) el.setAttribute('aria-label', t(el.dataset.tLabel));
  for (const b of document.querySelectorAll('#lang b')) b.classList.toggle('on', b.dataset.l === lang);
  listeners.forEach(fn => fn());
}

export function toggleLang() {
  lang = lang === 'en' ? 'ru' : 'en';
  try { localStorage.setItem('axioma-lang', lang); } catch { /* private mode: the choice lasts for this visit */ }
  applyLang();
}
