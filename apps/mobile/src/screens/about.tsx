import { Link } from 'expo-router';
import { Page,Title,Copy,Card,Button,ErrorText,palette } from '../components/ui';
import { ExternalButton } from '../components/public-details';
import { useLanguage } from '../localization/provider';
import { languages } from '../localization/controller';
const sections = [
 ['Share available capacity','Share capacity, routes and availability with brokers, shippers and receivers you know, or make them open to the public.'],
 ['Connect with transporters','Find a truck for your route and agree on the work directly with its transporter.'],
 ['Keep shipment partners informed','Transporters provide private tracking updates to brokers and their customers, or directly to businesses shipping or receiving goods.'],
 ['Build confidence','Optional document review helps customers assess the transporter, driver and truck behind a capacity signal.'],
] as const;
export default function About(){
 const {t,locale,select,busy,error}=useLanguage();
 return <Page><Title>{t('Share capacity. Keep customers informed.')}</Title><Copy>{t("Capacity sharing and professional shipment tracking for Ethiopia's transporters and the businesses they serve.")}</Copy>
 {sections.map(([title,body])=><Card key={title}><Title>{t(title)}</Title><Copy>{t(body)}</Copy></Card>)}
 <Link href="/" style={{color:palette.teal,paddingVertical:12}}>{t('Find capacity')}</Link>
 <Link href="/account" style={{color:palette.teal,paddingVertical:12}}>{t('Transporter login')}</Link>
 <Card><Title>{t('Language')}</Title><ErrorText message={error}/>{languages.map(language=><Button key={language.code} secondary={locale!==language.code} busy={busy&&locale===language.code} disabled={busy} label={`${locale===language.code?'✓ ':''}${language.name}`} onPress={()=>{void select(language.code);}}/>)}</Card>
 <ExternalButton label={t('Privacy')} url="https://loadgistic.com/privacy"/>
 <ExternalButton label={t('Terms')} url="https://loadgistic.com/terms"/>
 </Page>;
}
