from pathlib import Path
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

OUT = Path(__file__).resolve().parent.parent / 'Accord_confidentialite_tests_LISU.docx'
doc = Document()
s = doc.sections[0]
s.page_width, s.page_height = Cm(21), Cm(29.7)
s.top_margin, s.bottom_margin = Cm(1.9), Cm(1.8)
s.left_margin = s.right_margin = Cm(2)
normal = doc.styles['Normal']
normal.font.name = 'Calibri'
normal.font.size = Pt(11)
normal.font.color.rgb = RGBColor(0, 0, 0)
normal.paragraph_format.line_spacing = 1.05
normal.paragraph_format.space_after = Pt(6)
for name in ['Title', 'Subtitle', 'Heading 1']:
    st = doc.styles[name]
    st.font.name = 'Calibri'
    st.font.color.rgb = RGBColor(0, 0, 0)
title = doc.styles['Title']
title.font.size = Pt(19)
title.font.bold = True
title.paragraph_format.space_after = Pt(5)
head = doc.styles['Heading 1']
head.font.size = Pt(11)
head.font.bold = True
head.paragraph_format.space_before = Pt(8)
head.paragraph_format.space_after = Pt(3)
head.paragraph_format.keep_with_next = True
doc.core_properties.title = 'Accord de confidentialité pour les tests de LISU'
doc.core_properties.subject = 'Engagement de confidentialité et accès aux tests'
doc.core_properties.author = ''
doc.core_properties.keywords = 'LISU, confidentialité, tests, NDA'

doc.add_paragraph('Accord de confidentialité', 'Title')
p = doc.add_paragraph('Tests de l’application LISU')
p.paragraph_format.space_after = Pt(10)
p.runs[0].bold = True

def para(text):
    p = doc.add_paragraph(text)
    p.paragraph_format.keep_together = True
    return p

def clause(title, text):
    doc.add_paragraph(title, 'Heading 1')
    para(text)

para('Entre le responsable de l’application : [nom ou raison sociale], [adresse], représenté le cas échéant par [nom et qualité], ci-après « le Responsable » ;')
para('et le testeur : [nom et prénom], [adresse], [courriel], agissant à titre personnel ou pour [organisme et qualité], ci-après « le Testeur ».')
para('Les parties conviennent de protéger les informations communiquées à l’occasion des tests de LISU. Le présent accord doit être signé avant la remise des accès.')

clause('1 Objet et accès aux tests',
       'Le Responsable autorise le Testeur à utiliser LISU uniquement pour évaluer ses fonctionnalités, relever des anomalies et transmettre ses observations par le canal indiqué. L’accès est personnel, temporaire et limité au périmètre autorisé. Il ne permet ni exploitation commerciale, ni mise à disposition de tiers. Le Testeur respecte les consignes de test et les droits d’accès qui lui sont attribués.')
clause('2 Informations confidentielles',
       'Sont confidentiels les éléments non publics reçus ou consultés pendant les tests, quel que soit leur support : application et versions de test, interfaces, fonctionnalités, documentation, informations techniques, identifiants, données et pièces jointes, résultats de recherche, rapports, anomalies, échanges et projets de développement. Cette protection couvre aussi les captures, copies et notes qui en sont tirées, lorsque leur caractère confidentiel est indiqué ou ressort raisonnablement de leur nature ou du contexte.')
clause('3 Obligations du Testeur',
       'Le Testeur conserve ces informations confidentielles et les utilise exclusivement pour les tests. Sans autorisation écrite préalable du Responsable, il ne les communique à aucun tiers, ne publie aucune démonstration, capture, vidéo ou résultat de test et ne les transfère vers aucun service externe, y compris un outil d’intelligence artificielle. Les copies sont limitées à celles nécessaires aux tests et conservées dans les espaces autorisés. Il protège ses identifiants et ses appareils, ne partage pas son compte et signale sans délai tout accès indu, perte ou divulgation suspectée. Il ne contourne aucune restriction et ne procède à aucun test intrusif, extraction massive ou rétro-ingénierie sans autorisation écrite, sous réserve des droits impératifs applicables.')
clause('4 Exceptions et divulgations obligatoires',
       'La confidentialité ne couvre pas les informations dont le Testeur peut établir qu’elles étaient déjà licitement connues de lui, sont devenues publiques sans violation du présent accord, ont été reçues légalement d’un tiers autorisé ou ont été développées indépendamment. Toute divulgation exigée par la loi ou une autorité compétente reste limitée au nécessaire ; le Testeur en informe préalablement le Responsable, si la loi le permet. L’accord ne fait pas obstacle aux signalements protégés par la loi.')
clause('5 Données et propriété intellectuelle',
       'Le Testeur utilise les données fictives ou expressément autorisées pour les essais et n’introduit aucune donnée réelle concernant des tiers sans autorisation et base légale appropriées. Il ne réutilise pas les données consultées à des fins personnelles. Les droits sur LISU et les éléments fournis restent à leurs titulaires ; seul un droit d’usage limité aux tests est accordé. Le Testeur autorise gratuitement le Responsable à utiliser ses suggestions pour améliorer LISU, sans transfert de ses droits préexistants ni obligation de les mettre en œuvre.')
clause('6 Durée et fin des tests',
       'L’accord prend effet à sa signature. Chaque partie peut mettre fin aux tests par écrit ; le Responsable peut suspendre les accès en cas de manquement ou pour protéger l’application. La confidentialité et la limitation d’usage subsistent pendant cinq ans après la fin des tests. Pour les secrets d’affaires, elles subsistent aussi longtemps que les conditions de leur protection légale sont remplies. Dans les sept jours suivant la fin des tests ou une demande écrite, le Testeur restitue ou supprime les éléments confidentiels et leurs copies, puis le confirme par écrit. Toute conservation légalement obligatoire reste protégée et sans autre usage.')
clause('7 Manquement et règlement des différends',
       'LISU est une version de test susceptible de contenir des erreurs ; le Testeur évite tout usage opérationnel critique. Un manquement au présent accord peut entraîner le retrait des accès et les recours prévus par le droit applicable, notamment la cessation de la divulgation et la réparation du préjudice établi. Les parties recherchent d’abord une solution amiable pendant trente jours après notification écrite, sans empêcher une mesure urgente. Droit applicable : [pays]. Juridiction compétente : [ville et pays], sous réserve des règles impératives applicables. Toute modification de l’accord est écrite et acceptée par les deux parties.')

p = para('Fait à [ville], le [date], en deux exemplaires, un pour chaque partie.')
p.paragraph_format.space_before = Pt(9)
p.paragraph_format.keep_with_next = True
p = para('Le Responsable' + '\t' + 'Le Testeur')
p.paragraph_format.tab_stops.add_tab_stop(Cm(9))
p.paragraph_format.keep_with_next = True
for run in p.runs:
    run.bold = True
p = para('Nom et qualité : __________________' + '\t' + 'Nom : __________________________')
p.paragraph_format.tab_stops.add_tab_stop(Cm(9))
p.paragraph_format.keep_with_next = True
p = para('Signature :' + '\t' + 'Signature :')
p.paragraph_format.tab_stops.add_tab_stop(Cm(9))
p.paragraph_format.space_after = Pt(28)

# A small page number helps keep the two leaves together at signature.
footer = s.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
r = footer.add_run('LISU  |  ')
r.font.size = Pt(9)
fld = OxmlElement('w:fldSimple')
fld.set(qn('w:instr'), 'PAGE')
footer._p.append(fld)
# Remove the decorative border inherited from Word's default title style.
for root in (doc.styles.element, doc.element):
    for border in list(root.iter(qn('w:pBdr'))):
        border.getparent().remove(border)
OUT.parent.mkdir(parents=True, exist_ok=True)
doc.save(OUT)
print(str(OUT))
print('Words:', sum(len(p.text.split()) for p in doc.paragraphs))
