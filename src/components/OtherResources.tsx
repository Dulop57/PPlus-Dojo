import {ExternalLink} from 'lucide-react';
import {pplusGoogleDocsArchive} from '../data/external-links';
export default function OtherResources(){
  return <article className="document-page resource-library">
    <span className="eyebrow muted">PROJECT+ REFERENCES</span><h1>Other resources</h1>
    <p className="page-intro">Open the P+ Google Docs Archive for community references and resources.</p>
    <a className="text-link" href={pplusGoogleDocsArchive} target="_blank" rel="noreferrer">P+ Google Docs Archive <ExternalLink size={14}/></a>
  </article>;
}
