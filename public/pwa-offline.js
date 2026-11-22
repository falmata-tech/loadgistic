const copy = {
  am: [
    'ከበይነመረብ ተቋርጠዋል',
    'Loadgisticን ለመክፈት እንደገና ይገናኙ። መረጃ አስቀምጠው ከሆነ ደግመው ከመሞከርዎ በፊት መዝገቡን ይፈትሹ።',
    'እንደገና ይሞክሩ'
  ],
  om: [
    'Intarneetii irraa addaan cittaniittu',
    'Loadgistic banuuf deebiʼaa wal qunnamaa. Waan tokko olkaaʼattan yoo taʼe, irra deebiʼuu dura galmee isaa ilaalaa.',
    'Irra deebiʼaa yaalaa'
  ]
};
const locale = document.cookie.match(/(?:^|;\s*)loadgistic_language=(am|om)(?:;|$)/)?.[1];
const retry = document.querySelector('button');
if (locale) {
  document.documentElement.lang = locale;
  document.querySelector('h1').textContent = copy[locale][0];
  document.querySelector('p').textContent = copy[locale][1];
  retry.textContent = copy[locale][2];
}
retry.addEventListener('click', () => location.reload());
