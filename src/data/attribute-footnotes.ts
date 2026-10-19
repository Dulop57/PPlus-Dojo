export function attributeFighterNote(sheet:string,title:string,fighterName:string,groupName?:string):string|undefined{
  const fighter=fighterName.trim().replace(/\*+$/,'').toLowerCase();
  if(sheet==='Misc'&&title==='Wall movement'&&groupName==='Can Wall-Jump'&&fighter==='ike')return 'Ike can only walljump with his SideB, Quickdraw';
  if(sheet==='Misc'&&title==='Wall movement'&&groupName==='Can Wall-Cling'&&fighter==='knuckles')return 'Knuckles can only wallcling and climb with his SideB, Glide';
  return undefined;
}
