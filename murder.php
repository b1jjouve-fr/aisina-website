<?php
/* AISINA — formulaire de devis de la page Team Building.
   Reçoit le formulaire de demande de devis, le vérifie, et envoie le message par courriel.

   Déposer ce fichier à la racine du site, à côté de team-building.html.
   Il répond en JSON ({"ok": true} ou {"ok": false, "erreurs": {...}}) pour un
   envoi en arrière-plan, et sait aussi renvoyer vers la page quand le
   navigateur poste le formulaire sans JavaScript.

   ATTENTION : ce fichier n'a d'effet que sur un hébergement qui exécute PHP.
   GitHub Pages ne sert que des fichiers statiques et le livrera tel quel. */

declare(strict_types=1);

/* ------------------------------------------------------------- à régler */

/** Adresse qui reçoit les demandes. */
const DESTINATAIRE = 'CHANGEZ-MOI@aisina.net';

/** Adresse d'expédition. Elle doit appartenir au domaine qui envoie, sinon
 *  la plupart des messageries classeront le message en indésirable. */
const EXPEDITEUR = 'site@aisina.net';

/** Page vers laquelle revenir quand le navigateur poste sans JavaScript. */
const RETOUR = '/team-building.html';

/** Délai minimum entre deux envois depuis la même adresse IP, en secondes. */
const DELAI_ENTRE_ENVOIS = 60;

/** Fichier où le mode test écrit les messages, à côté de ce fichier. */
const JOURNAL_TEST = 'mails-test.log';

/* ----------------------------------------------------------- utilitaires */

/** Termine la requête : JSON pour un envoi en arrière-plan, redirection sinon. */
function repondre(int $code, array $charge): void
{
    $enJson = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json')
        || strtolower($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'xmlhttprequest';

    if ($enJson) {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($charge, JSON_UNESCAPED_UNICODE);
        exit;
    }

    $drapeau = ($charge['ok'] ?? false) ? 'envoye=1' : 'erreur=1';
    [$chemin, $ancre] = array_pad(explode('#', RETOUR, 2), 2, '');
    $separateur = str_contains($chemin, '?') ? '&' : '?';
    $cible = $chemin . $separateur . $drapeau . ($ancre !== '' ? '#' . $ancre : '');
    header('Location: ' . $cible, true, 303);
    exit;
}

/** Nettoie une valeur reçue : texte simple, sans caractères de contrôle. */
function propre(mixed $valeur): string
{
    if (!is_string($valeur)) {
        return '';
    }
    $valeur = str_replace("\0", '', $valeur);
    $valeur = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $valeur) ?? '';
    return trim($valeur);
}

/** Retire tout retour à la ligne : indispensable pour une valeur mise en
 *  en-tête de courriel, sinon on peut y injecter d'autres en-têtes. */
function sansRetour(string $valeur): string
{
    return trim(str_replace(["\r", "\n"], ' ', $valeur));
}

/** Un champ d'une seule ligne : on y remplace tout retour à la ligne par une
 *  espace, pour que le message reçu reste lisible. */
function uneLigne(mixed $valeur): string
{
    return sansRetour(propre($valeur));
}

/** Encode un texte non ASCII comme le veut la norme des courriels. Sert au
 *  sujet et au nom affiché de l'adresse de réponse : l'encodage met aussi à
 *  l'abri des caractères qui casseraient l'en-tête (chevrons, virgules). */
function motEncode(string $texte): string
{
    return '=?UTF-8?B?' . base64_encode(sansRetour($texte)) . '?=';
}

/** Chemin du témoin qui mémorise le dernier envoi de cette adresse IP. */
function temoin(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    return $ip === '' ? '' : sys_get_temp_dir() . '/aisina-' . hash('sha256', $ip) . '.txt';
}

/** Vrai si cette adresse IP a déjà envoyé il y a moins de DELAI_ENTRE_ENVOIS.
 *  Seul un envoi réussi pose le témoin : une erreur de saisie corrigée dans la
 *  foulée ne doit pas bloquer la personne. */
function tropTot(): bool
{
    $marque = temoin();
    return $marque !== '' && is_file($marque)
        && (time() - (int) filemtime($marque)) < DELAI_ENTRE_ENVOIS;
}

/** Note l'heure de cet envoi. */
function noterEnvoi(): void
{
    $marque = temoin();
    if ($marque !== '') {
        @touch($marque);
    }
}

/** Longueur en caractères. mb_strlen vient d'une extension presque toujours
 *  présente, mais pas garantie : sans elle on compte les octets, ce qui est
 *  plus sévère et jamais faux pour une limite haute. */
function longueur(string $valeur): int
{
    return function_exists('mb_strlen') ? mb_strlen($valeur, 'UTF-8') : strlen($valeur);
}

/** Vrai quand le site est servi en local. Le mode test en découle : rien n'est
 *  expédié, les messages s'ajoutent au journal. C'est l'adresse demandée par le
 *  navigateur qui décide, et non un réglage qu'on pourrait oublier d'éteindre
 *  avant la mise en ligne. */
function enLocal(): bool
{
    $hote = strtolower((string) ($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? ''));
    $hote = preg_replace('/:\d+$/', '', $hote) ?? '';   // retirer le port
    $hote = trim($hote, '[]');                           // retirer les crochets d'une adresse IPv6
    return $hote === 'localhost'
        || $hote === '127.0.0.1'
        || $hote === '::1'
        || str_ends_with($hote, '.localhost')
        || str_ends_with($hote, '.test');
}

/** Mode test : ajoute le message au journal au lieu de l'expédier. */
function journaliser(string $sujetLisible, string $corps, string $entetes): bool
{
    $bloc = implode("\n", [
        str_repeat('=', 72),
        'Le ' . date('d/m/Y à H:i:s') . ' — message NON expédié (mode test local)',
        'À     : ' . DESTINATAIRE,
        'Sujet : ' . $sujetLisible,
        '',
        $entetes,
        '',
        $corps,
        '',
    ]);
    return @file_put_contents(__DIR__ . '/' . JOURNAL_TEST, $bloc . "\n", FILE_APPEND | LOCK_EX) !== false;
}

/** Garde la valeur reçue seulement si elle fait partie des choix proposés. */
function parmi(string $valeur, array $choix): string
{
    return in_array($valeur, $choix, true) ? $valeur : '';
}

/* -------------------------------------------------------------- réception */

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    repondre(405, ['ok' => false, 'message' => 'Méthode non autorisée.']);
}

/* Piège à robots : un champ invisible que seul un automate remplit. */
if (propre($_POST['site'] ?? '') !== '') {
    /* On répond comme si tout allait bien, pour ne pas renseigner le robot. */
    repondre(200, ['ok' => true]);
}

if (tropTot()) {
    repondre(429, ['ok' => false, 'message' => 'Merci de patienter un instant avant un nouvel envoi.']);
}

/* ------------------------------------------------------------- les champs */

const PARTICIPANTS = [
    'Moins de 15',
    '15 à 40',
    'Plus de 40',
    'Pas encore défini',
];

$nom          = uneLigne($_POST['nom'] ?? '');
$entreprise   = uneLigne($_POST['entreprise'] ?? '');
$courriel     = uneLigne($_POST['email'] ?? '');
$telephone    = uneLigne($_POST['telephone'] ?? '');
$participants = parmi(propre($_POST['participants'] ?? ''), PARTICIPANTS);
$message      = propre($_POST['message'] ?? '');

$erreurs = [];

if ($nom === '') {
    $erreurs['nom'] = 'Merci d’indiquer votre nom.';
} elseif (longueur($nom) > 100) {
    $erreurs['nom'] = 'Ce nom est trop long.';
}

if ($courriel === '') {
    $erreurs['email'] = 'Merci d’indiquer votre e-mail professionnel.';
} elseif (!filter_var($courriel, FILTER_VALIDATE_EMAIL) || longueur($courriel) > 160) {
    $erreurs['email'] = 'Cette adresse e-mail ne semble pas valide.';
}

if ($entreprise !== '' && longueur($entreprise) > 100) {
    $erreurs['entreprise'] = 'Ce nom d’entreprise est trop long.';
}

if ($telephone !== '' && !preg_match('/^[0-9 ().+\/-]{6,30}$/', $telephone)) {
    $erreurs['telephone'] = 'Ce numéro ne semble pas valide.';
}

if (longueur($message) < 10) {
    $erreurs['message'] = 'Merci de décrire votre projet en quelques mots.';
} elseif (longueur($message) > 5000) {
    $erreurs['message'] = 'Ce texte est trop long.';
}

if ($erreurs !== []) {
    repondre(422, ['ok' => false, 'erreurs' => $erreurs]);
}

/* --------------------------------------------------------------- l’envoi */

$corps = implode("\n", [
    'Demande de devis Team Building depuis aisina.net',
    '',
    'Nom          : ' . $nom,
    'Entreprise   : ' . ($entreprise !== '' ? $entreprise : 'non précisée'),
    'E-mail       : ' . $courriel,
    'Téléphone    : ' . ($telephone !== '' ? $telephone : 'non précisé'),
    'Participants : ' . ($participants !== '' ? $participants : 'non précisé'),
    '',
    'Projet :',
    $message,
    '',
    '--',
    'Envoyé le ' . date('d/m/Y à H:i'),
]);

$entetes = implode("\r\n", [
    'From: Site Aisina <' . EXPEDITEUR . '>',
    'Reply-To: ' . motEncode($nom) . ' <' . sansRetour($courriel) . '>',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'MIME-Version: 1.0',
]);

$sujetLisible = 'Devis Team Building — ' . ($entreprise !== '' ? $entreprise : $nom);
$essai = enLocal();
$parti = $essai
    ? journaliser($sujetLisible, $corps, $entetes)
    : mail(DESTINATAIRE, motEncode($sujetLisible), $corps, $entetes, '-f' . EXPEDITEUR);

if (!$parti) {
    error_log('aisina/murder.php : envoi impossible pour ' . $courriel);
    repondre(500, ['ok' => false, 'message' => $essai
        ? 'Mode test : impossible d’écrire ' . JOURNAL_TEST . '. Vérifiez les droits du dossier.'
        : 'L’envoi a échoué. Écrivez-nous directement à ' . DESTINATAIRE . '.']);
}

noterEnvoi();
repondre(200, $essai ? ['ok' => true, 'test' => true] : ['ok' => true]);
