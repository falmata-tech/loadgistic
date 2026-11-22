import Link from 'next/link';
import {Text} from './localization';
import {TrackingEntryMap} from './tracking-entry-map';
import styles from './private-capacity-entry.module.css';

/** A public, record-free entry state. No Capacity feed or data port is mounted. */
export function PrivateCapacityEntry(){
 return <div className={styles.workspace} data-testid="private-capacity-entry">
  <TrackingEntryMap/>
  <section className={styles.card} aria-labelledby="private-capacity-entry-title">
   <h2 id="private-capacity-entry-title"><Text message="Private Network"/></h2>
   <p><Text message="Sign in to see vehicles your transport partners share with you."/></p>
   <div className={styles.actions}>
    <Link className="button" href="/login?from=shared-capacity"><Text message="Sign in"/></Link>
    <Link className="button secondary" href="/signup?audience=BUSINESS"><Text message="Sign up"/></Link>
   </div>
  </section>
 </div>;
}
