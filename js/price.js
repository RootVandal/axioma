// Picks the visitor's currency from their time zone and language; the other two stay underneath.
(() => {
  const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  const lang = (navigator.language || '').toLowerCase();
  const KZ = /^Asia\/(Almaty|Qyzylorda|Aqtobe|Aqtau|Atyrau|Oral|Qostanay)$/;
  const RU = /^(Europe\/(Moscow|Kaliningrad|Samara|Volgograd|Saratov|Ulyanovsk|Astrakhan|Kirov)|Asia\/(Yekaterinburg|Omsk|Novosibirsk|Barnaul|Tomsk|Novokuznetsk|Krasnoyarsk|Irkutsk|Chita|Yakutsk|Khandyga|Vladivostok|Ust-Nera|Magadan|Sakhalin|Srednekolymsk|Kamchatka|Anadyr))$/;
  const cur = KZ.test(tz) || lang.startsWith('kk') ? 'kzt' : RU.test(tz) ? 'rub' : 'usd';
  for (const el of document.querySelectorAll('[data-kzt]')) {
    const main = el.querySelector('.p-main'), alt = el.querySelector('.p-alt');
    const v = { kzt: el.dataset.kzt, usd: el.dataset.usd, rub: el.dataset.rub };
    main.textContent = (el.dataset.from || '') + v[cur];
    alt.textContent = ['kzt', 'usd', 'rub'].filter(k => k !== cur).map(k => '≈ ' + v[k]).join(' · ');
  }
})();
