import {publicRobots} from '@/lib/seo.js';
type RobotsFile={rules:{userAgent:string;allow?:string;disallow?:string};sitemap?:string};
export default function robots():RobotsFile{return publicRobots();}
