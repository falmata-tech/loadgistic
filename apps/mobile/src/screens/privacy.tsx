import {useState} from 'react';
import {privacyContact,privacySections} from '../../../../src/lib/privacy-copy.js';
import {Page,Title,Copy,Card,Button} from '../components/ui';
import {ExternalButton} from '../components/public-details';
import {LocationDisclosure} from '../components/location-disclosure';
import {BlockedProviders} from '../components/blocked-providers';
import {useLanguage} from '../localization/provider';
import {AppLink} from '../components/app-link';
export default function Privacy(){const {t}=useLanguage();const [location,setLocation]=useState(false);return <Page><Title message="Privacy"/><Copy message="Updated October 9, 2026"/>{privacySections.map(([title,body])=><Card key={title}><Title>{t(title)}</Title><Copy>{t(body)}</Copy></Card>)}<Button secondary message="How location sharing works" onPress={()=>setLocation(true)}/><LocationDisclosure visible={location} informational decide={()=>setLocation(false)}/><BlockedProviders/><Title message="Privacy contact"/><ExternalButton label={privacyContact} url={`mailto:${privacyContact}`}/><AppLink href="/delete-account" message="Delete account and data" style={{color:'#0c7275',paddingVertical:12}}/></Page>}
