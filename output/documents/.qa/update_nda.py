from pathlib import Path
from docx import Document

BASE = Path(__file__).resolve().parent.parent
doc = Document(BASE / 'Accord_confidentialite_tests_LISU.docx')
replacements = {
    'Tests de l’application LISU': 'Tests et interventions techniques sur LISU',
    'et le testeur :': 'et l’intervenant : [nom et prénom], [adresse], [courriel], agissant à titre personnel ou pour [organisme et qualité], ci-après « l’Intervenant ». Fonction et mission : [à préciser].',
    'Les parties conviennent': 'Le présent accord protège les informations accessibles dans le cadre des tests, du développement, des mises à jour, de la maintenance ou de l’amélioration de LISU. Il s’applique notamment aux testeurs, ingénieurs, développeurs, consultants et autres contributeurs et doit être signé avant toute communication d’informations confidentielles ou remise d’accès.',
    '1 Objet et accès aux tests': '1 Objet et périmètre de la mission',
    'Le Responsable autorise le Testeur': 'L’Intervenant utilise LISU et les ressources mises à disposition uniquement pour la mission convenue par écrit avec le Responsable : tests, correction d’anomalies, développement, maintenance, audit, mise à jour ou amélioration fonctionnelle, technique ou ergonomique. Ses accès sont personnels et limités aux besoins de cette mission. Toute intervention en production ou modification hors périmètre nécessite une autorisation écrite préalable. Aucun accès ni travail ne peut être confié à un tiers sans cette autorisation et un engagement de confidentialité approprié.',
    'Sont confidentiels': 'Sont confidentiels les éléments non publics reçus, consultés ou produits au cours de la mission : code source et dépôts, architecture, algorithmes, interfaces, documentation, configurations, identifiants et clés, infrastructures, bases de données, données personnelles et pièces jointes, résultats, rapports, vulnérabilités, projets et développements. La protection couvre également les versions, correctifs, livrables, captures, copies et notes qui révèlent ces informations, lorsque leur confidentialité est indiquée ou ressort raisonnablement de leur nature ou du contexte.',
    '3 Obligations du Testeur': '3 Confidentialité et sécurité',
    'Le Testeur conserve': 'L’Intervenant conserve ces informations confidentielles et les utilise exclusivement pour la mission. Sans autorisation écrite préalable, il ne les divulgue pas, ne publie aucun code, capture, démonstration ou résultat et ne les transfère vers aucun dépôt, espace personnel ou service externe, y compris un outil d’intelligence artificielle. Il limite les copies au nécessaire et utilise les outils et espaces autorisés. Il protège ses appareils et identifiants, ne partage pas ses comptes et signale sans délai tout incident ou divulgation suspectée. Il respecte les droits d’accès et les procédures de validation, de sauvegarde et de déploiement communiquées. Aucun contournement de sécurité, test intrusif, extraction massive ou rétro-ingénierie hors mission n’est autorisé, sous réserve des droits impératifs applicables.',
    'La confidentialité ne couvre': 'La confidentialité ne couvre pas les informations dont l’Intervenant peut établir qu’elles étaient déjà licitement connues de lui, sont devenues publiques sans violation de l’accord, ont été reçues légalement d’un tiers autorisé ou ont été développées indépendamment. Une divulgation imposée par la loi ou une autorité compétente est limitée au nécessaire ; l’Intervenant en informe préalablement le Responsable si la loi le permet. L’accord ne fait pas obstacle aux signalements protégés par la loi.',
    'Le Testeur utilise': 'L’Intervenant utilise uniquement les données nécessaires et autorisées et n’introduit aucune donnée réelle de tiers sans autorisation et base légale appropriées. Il ne réutilise pas les données ou éléments confidentiels pour son compte ou pour un tiers. Les droits préexistants sur LISU et les éléments fournis restent à leurs titulaires ; seuls les usages nécessaires à la mission sont autorisés. Les droits sur les développements, correctifs et autres livrables, ainsi que leur éventuelle rémunération, doivent être définis par écrit dans un contrat de mission avant leur réalisation. Le présent accord ne vaut pas, à lui seul, cession de droits de propriété intellectuelle.',
    '6 Durée et fin des tests': '6 Durée et fin de la mission',
    'L’accord prend effet': 'L’accord prend effet à sa signature. Le Responsable peut suspendre les accès en cas de manquement ou pour protéger LISU, sans préjudice du contrat de mission. La confidentialité et la limitation d’usage subsistent cinq ans après la fin de l’intervention et, pour les secrets d’affaires, aussi longtemps que les conditions de leur protection légale sont remplies. Dans les sept jours suivant la fin de la mission ou une demande écrite, l’Intervenant remet les travaux et éléments du projet en sa possession, restitue ou supprime les informations confidentielles et leurs copies, puis le confirme par écrit. Toute conservation légalement obligatoire reste protégée et sans autre usage.',
    'LISU est une version': 'Un manquement peut entraîner le retrait des accès et les recours prévus par le droit applicable, notamment la cessation de la divulgation et la réparation du préjudice établi. Les parties recherchent une solution amiable pendant trente jours après notification écrite, sans empêcher une mesure urgente. Droit applicable : [pays]. Juridiction compétente : [ville et pays], sous réserve des règles impératives applicables. Toute modification de l’accord est écrite et acceptée par les deux parties. Les conditions de réalisation et de fin de la mission sont fixées dans le contrat correspondant.',
    'Le Responsable\tLe Testeur': 'Le Responsable\tL’Intervenant',
}
matched = set()
for p in doc.paragraphs:
    for prefix, value in replacements.items():
        if p.text.startswith(prefix):
            # Preserve paragraph and run formatting from the original agreement.
            p.runs[0].text = value
            for run in p.runs[1:]:
                run.text = ''
            matched.add(prefix)
            break
assert matched == set(replacements), set(replacements) - matched
text = '\n'.join(p.text for p in doc.paragraphs)
assert 'Testeur' not in text and 'fin des tests' not in text
doc.core_properties.title = 'Accord de confidentialité pour les intervenants sur LISU'
doc.core_properties.subject = 'Tests, développement, mises à jour, maintenance et amélioration de LISU'
doc.core_properties.keywords = 'LISU, confidentialité, intervenants, ingénieurs, NDA'
output = BASE / 'Accord_confidentialite_intervenants_LISU.docx'
doc.save(output)
print(output)
print('Words:', len(text.split()))
