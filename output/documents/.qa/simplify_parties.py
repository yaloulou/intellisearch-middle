from pathlib import Path
import re
from docx import Document

path = Path(__file__).resolve().parent.parent / 'Accord_confidentialite_intervenants_LISU.docx'
doc = Document(path)
for p in list(doc.paragraphs):
    old = p.text
    text = old
    if old.startswith('Entre le responsable de l’application'):
        text = 'Entre LISU, d’une part,'
    elif old.startswith('et l’intervenant :'):
        text = 'et ______________________________________________________________, ci-après « l’Intervenant », d’autre part.'
    elif old.startswith('Nom et qualité :'):
        p._element.getparent().remove(p._element)
        continue
    else:
        for before, after in [
            ('avec le Responsable', 'avec LISU'),
            ('du Responsable', 'de LISU'),
            ('au Responsable', 'à LISU'),
            ('Le Responsable', 'LISU'),
            ('le Responsable', 'LISU'),
            ('[ville et pays]', '____________________________'),
            ('[pays]', '____________________'),
            ('[ville]', '____________________'),
            ('[date]', '____ / ____ / ________'),
        ]:
            text = text.replace(before, after)
    if text != old:
        p.runs[0].text = text
        for run in p.runs[1:]:
            run.text = ''
full_text = '\n'.join(p.text for p in doc.paragraphs)
assert 'Responsable' not in full_text
assert not re.search(r'\[[^\]]*\]', full_text)
assert 'adresse' not in full_text and 'courriel' not in full_text
output = path.with_name('Accord_confidentialite_LISU_intervenant.docx')
doc.save(output)
print(output)
print('Words:', len(full_text.split()))
