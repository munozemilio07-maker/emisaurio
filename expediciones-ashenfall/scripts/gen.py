import json
exps=json.load(open('exps.json'))
Q={'quest_withering_heights':'Withering Heights','quest_mirror_mirror':'Mirror, Mirror','quest_letters_dead':'Letters from the Dead','quest_heartstrings':'Heartstrings','quest_what_remains':'What Remains','quest_scarecrowscavenging':'Scarecrow Scavenging','quest_even_more_ghosts':'Even More Restless Ghosts','quest_greatbodyrobbery':'The Great Body Robbery','quest_goblin_diplomacy':'Goblin Diplomacy','quest_animalmagnetism':'Animal Magnetism','quest_ftue_fishing':'Wise Old Man (pesca)','quest_eldergarou':'Elder Garou'}
NPC={'abraxus_the_eternal':'Abraxus the Eternal','advert-inna-bottle':'Advert-Inna-Bottle','bilegut':'Bilegut','caratacus_the_elder':'Caratacus the Elder','cathan':'Cathan','death':'Death','doctor_fenkenstrain':'Doctor Fenkenstrain','doric':'Doric','edna':'Edna','ghost':'Fantasma','ghost_of_cathan':'Ghost of Cathan','lougrims_shrine':'Santuario de Lougrim','manktongue':'Manktongue','parcel_pete':'Parcel Pete','postie_pete':'Postie Pete','pulpknuckle':'Pulpknuckle','scarecrow':'Espantapájaros','slopfinger':'Slopfinger','undead_chicken':'Pollo no-muerto','undead_tree':'Árbol no-muerto','vannaka':'Vannaka','wise_old_man':'Wise Old Man','wormelbow':'Wormelbow','zanik':'Zanik'}
BOSS={'abyssal_demon':'Abyssal Demon','green_dragon':'Dragón verde','zogre':'Zogre','plague_king':'Plague King','ulgo_the_zogre':'Ulgo the Zogre','razlem_the_necromancer':'Razlem the Necromancer','blightscale_the_lesser_green_dragon':'Blightscale (dragón verde menor)'}
SEC={'kebbit_burrow':'Madriguera de kebbit','spectral_bird':'Pájaro espectral','sanguine_urn':'Urna sanguina','nature_spirit':'Espíritu de la naturaleza','spectral_room':'Sala espectral','statue':'Estatua de Saradomin','standing_stone':'Piedra erguida','reliquary':'Relicario','dragon_tooth':'Diente de dragón','curse_seal':'Sello de maldición','agility_course':'Circuito de agilidad'}
def lab(p):
    s,n=p['sub'],p['name']
    if s=='treasure_chest': return 'cofre','Cofre del tesoro',''
    if s=='lore_item': return 'lore',n or 'Objeto de lore',''
    if s=='vault': return 'vault',n,'Dragonkin Vault'
    if s=='lodestone': return 'viaje',n,'Lodestone'
    if s in Q: return 'mision',n or Q[s],Q[s]
    if s in BOSS: return 'jefe',BOSS[s],'Enemigo importante'
    if s in SEC:
        t=SEC[s]
        if s=='spectral_room' and n: t='Sala espectral '+n.split()[-1]
        if s=='agility_course' and n: t='Agilidad: '+n
        return 'secreto',t,''
    if s in NPC: return 'npc',NPC[s],'NPC'
    return 'npc',n or s,''
out=[]
for i,e in enumerate(exps):
    st=[]
    for p in e['stops']:
        k,t,sub=lab(p); st.append([p['id'],k,t,sub,p['la'],p['ln']])
    out.append({'r':e['region'],'n':e['near'],'s':st})
json.dump(out,open('data.json','w'),ensure_ascii=False,separators=(',',':'))
import collections
for e in out: print(e['n'],dict(collections.Counter(s[1] for s in e['s'])))
