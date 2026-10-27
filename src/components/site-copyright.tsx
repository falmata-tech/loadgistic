import {Text} from './localization';

export function SiteCopyright(){
 return <footer className="site-copyright">
  <span>© {new Date().getFullYear()} <a href="https://marketvisiontech.com/" target="_blank" rel="noopener noreferrer"><Text message="MarketVision Technology"/></a></span>{' '}
  <span><Text message="Jigjiga, Somali Region, Ethiopia"/></span>
 </footer>;
}
