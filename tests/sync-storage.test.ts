import 'fake-indexeddb/auto';
import {describe,it,expect} from 'vitest';
import {setStudyAccount,saveReview,saveProgress,loadStudyProgress,loadStudyReviews,saveSettings,loadSettings,pendingSyncRecords,acknowledgeSync,applyCloudRecord,defaultSettings,rateCard,Rating,exportStudyBackup,importStudyBackup} from '../src/data/study-progress';
import {compareVersion,reviewIdentity,type SyncRecord} from '../src/data/sync-records';
const makeReview=(id='fixture',at='2026-10-01T12:00:00Z')=>rateCard(id,'10',undefined,Rating.Good,defaultSettings,new Date(at));
describe('Durable study sync and account storage',()=>{
  it('keeps guest and different signed-in users isolated',async()=>{
    setStudyAccount(null);const guest=makeReview('guest');await saveReview(guest.progress,guest.review);
    setStudyAccount('alice');expect((await loadStudyProgress()).size).toBe(0);await saveSettings({...defaultSettings,newPerDay:35});
    const alice=makeReview('alice');await saveReview(alice.progress,alice.review);
    setStudyAccount('bob');expect((await loadStudyProgress()).size).toBe(0);expect(await loadSettings()).toEqual(defaultSettings);
    setStudyAccount('alice');expect((await loadStudyProgress()).has('alice')).toBe(true);expect((await loadSettings()).newPerDay).toBe(35);
    setStudyAccount(null);expect((await loadStudyProgress()).has('guest')).toBe(true);expect((await loadStudyProgress()).has('alice')).toBe(false);
  });
  it('commits reviews and the sync queue together and does not acknowledge newer edits',async()=>{
    setStudyAccount('queue-test');const result=makeReview();await saveReview(result.progress,result.review);
    const records=await pendingSyncRecords('queue-test');expect(records.map(r=>r.kind).sort()).toEqual(['progress','reviews']);
    const old=records.find(r=>r.kind==='progress')!;await saveProgress({...result.progress,suspended:true});await acknowledgeSync(old,'queue-test');
    const updated=(await pendingSyncRecords('queue-test')).find(r=>r.kind==='progress')!;
    expect(updated.version.revision).not.toBe(old.version.revision);expect((await loadStudyProgress()).get('fixture')!.suspended).toBe(true);
    expect(await applyCloudRecord(old,'queue-test')).toBe(false);expect((await loadStudyProgress()).get('fixture')!.suspended).toBe(true);
    await acknowledgeSync(updated,'queue-test');expect((await pendingSyncRecords('queue-test')).some(r=>r.kind==='progress')).toBe(false);
  });
  it('applies newer remote records, preserves review dates, and deduplicates repeated syncs',async()=>{
    setStudyAccount('remote-test');const {progress,review}=makeReview();await saveProgress(progress);
    const local=(await pendingSyncRecords('remote-test'))[0],remote:SyncRecord={...local,payload:JSON.stringify({...progress,suspended:true}),version:{at:local.version.at+1000,revision:crypto.randomUUID()}};
    expect(compareVersion(remote.version,local.version)).toBeGreaterThan(0);expect(await applyCloudRecord(remote,'remote-test')).toBe(true);
    expect((await pendingSyncRecords('remote-test')).length).toBe(0);expect((await loadStudyProgress()).get('fixture')!.card.due).toBeInstanceOf(Date);
    const log:SyncRecord={key:reviewIdentity(review),kind:'reviews',payload:JSON.stringify(review),version:remote.version};
    await applyCloudRecord(log,'remote-test');await applyCloudRecord(log,'remote-test');expect(await loadStudyReviews()).toHaveLength(1);
    expect((await loadStudyReviews())[0].log.review).toBeInstanceOf(Date);
  });
  it('merges imported progress and queues it once without duplicating history',async()=>{
    setStudyAccount('import-source');const result=makeReview();await saveReview(result.progress,result.review);const backup=await exportStudyBackup();
    setStudyAccount('import-destination');await importStudyBackup(backup);await importStudyBackup(JSON.parse(JSON.stringify(backup)));
    expect(await loadStudyReviews()).toHaveLength(1);expect((await pendingSyncRecords('import-destination')).filter(r=>r.kind==='reviews')).toHaveLength(1);
    const newer=rateCard('fixture','10',result.progress,Rating.Easy,defaultSettings,new Date('2026-10-02T12:00:00Z'));await saveReview(newer.progress,newer.review);await importStudyBackup(backup);
    expect((await loadStudyProgress()).get('fixture')!.card.last_review!.toISOString()).toBe('2026-10-02T12:00:00.000Z');
  });
  it('rejects malformed cloud schedules before modifying local data',async()=>{
    setStudyAccount('invalid-test');const {progress}=makeReview();
    const record:SyncRecord={key:'progress:fixture',kind:'progress',payload:JSON.stringify({...progress,card:{...progress.card,state:100}}),version:{at:Date.now(),revision:crypto.randomUUID()}};
    await expect(applyCloudRecord(record,'invalid-test')).rejects.toThrow('scheduling');expect((await loadStudyProgress()).size).toBe(0);
  });
});
