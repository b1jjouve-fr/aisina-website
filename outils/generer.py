#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AISINA - fabrique les fiches des pages a partir des fichiers de content/.

    python3 outils/generer.py             reecrit index.html, team-building.html et js/site.js
    python3 outils/generer.py --verifier  ne touche a rien, signale seulement les ecarts

Seules les zones encadrees par des reperes sont reecrites :

    <!-- contenu:equipe-fiches -->   ...   <!-- /contenu:equipe-fiches -->

Tout ce qui se trouve en dehors de ces reperes n'est jamais modifie. Pour changer
un texte, une photo ou un scenario, modifier le JSON puis relancer cette commande.
"""

import json
import os
import re
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# --- styles repris tels quels de l'export d'origine (mise en forme, pas contenu) ---
EQ_ROLE        = "font-family: 'Space Mono', monospace; text-transform: uppercase; letter-spacing: 0.2em; font-size: 12px; color: #D08A44"
EQ_NOM         = "margin: 22px 0 0; font-family: 'Fraunces', serif; font-weight: 300; font-size: 80px; line-height: 1.02; letter-spacing: -0.01em; color: #F3EEE3"
EQ_PARA_1      = 'margin: 36px 0 0; font-size: 20px; line-height: 1.7; color: #C9BFAE'
EQ_PARA_SUITE  = 'margin: 24px 0 0; font-size: 20px; line-height: 1.7; color: #C9BFAE'
EQ_TITRE_JEUX  = "margin-top: 56px; padding-bottom: 12px; font-family: 'Space Mono', monospace; text-transform: uppercase; letter-spacing: 0.2em; font-size: 11px; color: #D08A44"
EQ_JEU_TITRE   = "font-family: 'Fraunces', serif; font-weight: 300; font-size: 26px; line-height: 1.2; color: #F3EEE3"
EQ_JEU_GENRE   = "flex: none; font-family: 'Space Mono', monospace; text-transform: uppercase; letter-spacing: 0.16em; font-size: 10px; color: #8E8678"
EQ_PILL        = '<a class="pill" href="#missions" onClick="{{ toMissions }}">Disponible en mission →</a>'

TB_ETAPE_PREMIERE = 'display: grid; grid-template-columns: 56px minmax(0, 1fr); column-gap: 8px; align-items: start; padding: 28px 0; padding-top: 0'
TB_ETAPE          = 'display: grid; grid-template-columns: 56px minmax(0, 1fr); column-gap: 8px; align-items: start; padding: 28px 0; border-top: 1px solid rgba(201, 191, 174, 0.3)'
TB_ETAPE_NUM      = "font-family: 'Space Mono', monospace; text-transform: uppercase; letter-spacing: 0.2em; font-size: 11px; color: #D08A44; padding-top: 10px"
TB_ETAPE_TITRE    = "font-family: 'Fraunces', serif; font-weight: 300; font-size: 32px; line-height: 1.12; color: #F3EEE3"
TB_ETAPE_TEXTE    = 'margin: 12px 0 0; font-size: 17px; line-height: 1.6; color: #C9BFAE'

TB_CARTE  = 'position: relative; box-sizing: border-box; border-radius: 24px; overflow: hidden; background: rgba(201, 191, 174, 0.12); border: 1px solid rgba(201, 191, 174, 0.5); backdrop-filter: blur(14px); display: flex; flex-direction: column'
TB_MEDIA  = 'position: relative; flex: none; height: 232px; overflow: hidden'
TB_FOND   = 'position: absolute; inset: 0; background: url(assets/%s) %s / cover no-repeat; filter: brightness(.58) saturate(1.0)'
TB_COUCHE = 'position: absolute; inset: 0; overflow: hidden'
TB_PERSO  = 'position: absolute; bottom: 0; left: %spx; height: %spx; width: auto; z-index: %s; display: block; filter: brightness(.88) saturate(.92) drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))'
TB_CORPS  = 'flex: 1; box-sizing: border-box; padding: 26px 28px 28px; display: flex; flex-direction: column'
TB_ETIQ   = "font-family: 'Space Mono', monospace; text-transform: uppercase; letter-spacing: 0.2em; font-size: 11px; font-size: 10px; color: #D08A44"
TB_TITRE  = "margin-top: 10px; font-family: 'Fraunces', serif; font-weight: 300; font-size: 32px; line-height: 1.1; color: #F3EEE3"
TB_DESC   = 'margin: 12px 0 28px; font-size: 15.5px; line-height: 1.55; color: #C9BFAE'
TB_TAGS   = 'margin-top: auto; display: flex; flex-wrap: wrap; gap: 8px'
TB_TAG    = "padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(201, 191, 174, 0.5); font-family: 'Space Mono', monospace; text-transform: uppercase; letter-spacing: 0.2em; font-size: 11px; font-size: 10px; letter-spacing: 0.12em; color: #C9BFAE"

TITRES = {'metier': ('<h2 style="position: absolute; left: 160px; top: 198px; width: 1120px; margin: 0; font-family: \'Fraunces\', serif; font-weight: 300; font-size: 104px; line-height: 1.08; letter-spacing: -0.01em">', ' </h2>'), 'equipe': ('<h2 style="margin: 0; white-space: nowrap; font-family: \'Fraunces\', serif; font-weight: 300; font-size: 76px; line-height: 1.06; letter-spacing: -0.01em">', '</h2>'), 'contact': ('<h2 style="width: 560px; margin: 0; font-family: \'Fraunces\', serif; font-weight: 300; font-size: 84px; line-height: 1.06; letter-spacing: -0.01em">', '</h2>'), 'tb_histoire': ('<h2 style="max-width: 900px; margin: 0; font-family: \'Fraunces\', serif; font-weight: 300; font-size: 68px; line-height: 1.06; letter-spacing: -0.01em">', '</h2>'), 'tb_exemples': ('<h2 style="margin: 0; font-family: \'Fraunces\', serif; font-weight: 300; font-size: 60px; line-height: 1.06; letter-spacing: -0.01em">', '</h2>')}

TONS = {'sombre': '#7D766A', 'clair': '#F3EEE3'}


def lire(nom):
    with open(os.path.join(RACINE, 'content', nom), encoding='utf-8') as f:
        return json.load(f)


# ----------------------------------------------------------------- accueil
def equipe_photos(eq):
    lignes = []
    for i, m in enumerate(eq['membres']):
        lignes.append(
            '<div class="ph" style="{{ p%d }}">'
            '<img src="assets/equipe/%s-fond.webp" alt="">'
            '<img class="pp" src="assets/equipe/%s-portrait.webp" alt="Portrait de %s %s"></div>'
            % (i, m['photo'], m['photo'], m['prenom'], m['nom']))
    return lignes


def equipe_fiches(eq):
    lignes = []
    for i, m in enumerate(eq['membres']):
        lignes.append('<section id="m%d" class="mbr snap">' % i)
        lignes.append('<div class="rvt" style="margin-left: 420px; width: 700px">')
        lignes.append('<div style="%s">%s</div>' % (EQ_ROLE, m['role']))
        lignes.append('<h3 style="%s">%s <span style="color: #7D766A">%s</span></h3>'
                      % (EQ_NOM, m['prenom'], m['nom']))
        for n, para in enumerate(m['paragraphes']):
            lignes.append('<p style="%s">%s</p>' % (EQ_PARA_1 if n == 0 else EQ_PARA_SUITE, para))
        lignes.append('<div style="%s">%s</div>' % (EQ_TITRE_JEUX, eq['titre_jeux_preferes']))
        lignes.append(''.join(
            '<div class="gm"><span style="%s">%s</span><span style="%s">%s</span></div>'
            % (EQ_JEU_TITRE, j['titre'], EQ_JEU_GENRE, j['genre']) for j in m['jeux_preferes']))
        if m.get('disponible_en_mission'):
            lignes.append(EQ_PILL)
        lignes.append('</div>')
        lignes.append('</section>')
    return lignes


def equipe_identifiants(eq):
    ids = ', '.join("'m%d'" % i for i in range(len(eq['membres'])))
    return ['  const MEMBRES = [%s];' % ids]


# ----------------------------------------------------------- team building
def scenarios_etapes(sc):
    lignes = []
    for n, e in enumerate(sc['etapes']):
        lignes.append(
            '<div style="%s"><span style="%s">%s</span><div><div style="%s">%s</div>'
            '<p style="%s">%s</p></div></div>'
            % (TB_ETAPE_PREMIERE if n == 0 else TB_ETAPE, TB_ETAPE_NUM, e['numero'],
                TB_ETAPE_TITRE, e['titre'], TB_ETAPE_TEXTE, e['texte']))
    return lignes


def scenarios_cartes(sc):
    lignes = []
    for c in sc['scenarios']:
        f = c['fond']
        personnages = ''.join(
            '<img src="assets/%s" alt="" style="%s">'
            % (p['fichier'], TB_PERSO % (p['gauche'], p['hauteur'], p['plan']))
            for p in c['personnages'])
        lignes.append('<div style="%s">' % TB_CARTE)
        lignes.append('<div style="%s"><div style="%s"></div>'
                      '<div aria-hidden="true" style="%s">%s</div></div>'
                      % (TB_MEDIA, TB_FOND % (f['fichier'], f['cadrage']), TB_COUCHE, personnages))
        lignes.append('<div style="%s">' % TB_CORPS)
        lignes.append('<div style="%s">%s</div>' % (TB_ETIQ, c['etiquette']))
        lignes.append('<div style="%s">%s</div>' % (TB_TITRE, c['titre']))
        lignes.append('<p style="%s">%s</p>' % (TB_DESC, c['description']))
        lignes.append('<div style="%s">%s</div>'
                      % (TB_TAGS, ''.join('<span style="%s">%s</span>' % (TB_TAG, t)
                                          for t in c['mots_cles'])))
        lignes.append('</div></div>')
    return lignes


# ------------------------------------------------------------------ titres
def titre(cle, t):
    ouverture, fermeture = TITRES[cle]
    mots = []
    for n, m in enumerate(t['mots']):
        couleur = TONS[m['ton']]
        if 'delai_debut' in t:
            delai = t['delai_debut'] + n * t['delai_pas']
            mots.append('<span class="gw" style="color: %s; animation-delay: %ss">%s</span>'
                        % (couleur, t['format_delai'] % delai, m['texte']))
        else:
            mots.append('<span style="color: %s">%s</span>' % (couleur, m['texte']))
    return [ouverture + ' '.join(mots) + fermeture]


def fabrique_titre(cle):
    return lambda tx: titre(cle, tx[cle])


# ------------------------------------------------------------------ moteur
PLAN = [
    ('index.html',         'equipe-photos',       'equipe.json',    equipe_photos),
    ('index.html',         'equipe-fiches',       'equipe.json',    equipe_fiches),
    ('index.html',         'titre-metier',        'textes.json',    fabrique_titre('metier')),
    ('index.html',         'titre-equipe',        'textes.json',    fabrique_titre('equipe')),
    ('index.html',         'titre-contact',       'textes.json',    fabrique_titre('contact')),
    ('js/site.js',         'equipe-identifiants', 'equipe.json',    equipe_identifiants),
    ('team-building.html', 'etapes',              'scenarios.json', scenarios_etapes),
    ('team-building.html', 'cartes',              'scenarios.json', scenarios_cartes),
    ('team-building.html', 'titre-histoire',      'textes.json',    fabrique_titre('tb_histoire')),
    ('team-building.html', 'titre-exemples',      'textes.json',    fabrique_titre('tb_exemples')),
]


def reperes(fichier, nom):
    if fichier.endswith('.js'):
        return '  /* contenu:%s */' % nom, '  /* /contenu:%s */' % nom
    return '<!-- contenu:%s -->' % nom, '<!-- /contenu:%s -->' % nom


def remplacer(texte, fichier, nom, lignes):
    debut, fin = reperes(fichier, nom)
    motif = re.compile(re.escape(debut) + r'\n.*?\n' + re.escape(fin), re.S)
    if not motif.search(texte):
        raise SystemExit('Reperes "%s" introuvables dans %s.' % (nom, fichier))
    return motif.sub(lambda _: debut + '\n' + '\n'.join(lignes) + '\n' + fin, texte, count=1)


def main():
    verifier = '--verifier' in sys.argv
    donnees = {}
    for _, _, source, _ in PLAN:
        donnees.setdefault(source, lire(source))

    avant, apres = {}, {}
    for fichier, nom, source, fabrique in PLAN:
        chemin = os.path.join(RACINE, fichier)
        if fichier not in avant:
            with open(chemin, encoding='utf-8') as f:
                avant[fichier] = apres[fichier] = f.read()
        apres[fichier] = remplacer(apres[fichier], fichier, nom, fabrique(donnees[source]))

    change = [f for f in avant if avant[f] != apres[f]]
    if verifier:
        if change:
            print('Ecart entre content/ et : ' + ', '.join(sorted(change)))
            print('Lancer : python3 outils/generer.py')
            return 1
        print('content/ et les pages sont d\'accord.')
        return 0

    for fichier in sorted(change):
        with open(os.path.join(RACINE, fichier), 'w', encoding='utf-8') as f:
            f.write(apres[fichier])
        print('reecrit : ' + fichier)
    if not change:
        print('rien a changer.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
