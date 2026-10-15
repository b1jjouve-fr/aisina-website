<?php
/* AISINA — formulaire de contact de l’accueil.
   Reçoit le formulaire de la section Contact de l’accueil, le vérifie, et envoie le message par courriel.

   Déposer ce fichier à la racine du site, à côté de index.html.
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
const RETOUR = '/#contact';

/** Délai minimum entre deux envois depuis la même adresse IP, en secondes. */
const DELAI_ENTRE_ENVOIS = 60;

/** Fichier où le mode test écrit les messages, à côté de ce fichier. */
const JOURNAL_TEST = 'mails-test.log';

/** Domaine connu pour exister, qui sert à savoir si la résolution de noms
 *  fonctionne avant de refuser une adresse. Voir domaineAccepteLeCourrier(). */
const DOMAINE_TEMOIN = 'iana.org';

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

/** Vrai si le domaine de cette adresse est capable de recevoir du courrier.

 *  filter_var ne juge que la forme : « aaa@bbb.cc » lui convient alors que ce
 *  domaine n'existe pas. On regarde donc s'il annonce un serveur de courrier.
 *  Cela ne dit pas si la boîte existe — seul un courriel de confirmation le
 *  dirait — mais cela écarte les adresses inventées.
 *
 *  Garde-fou : si le domaine ne répond pas, on vérifie d'abord qu'un domaine
 *  connu répond. Sans réseau, toute adresse paraîtrait fausse et plus personne
 *  ne pourrait écrire : dans ce cas on laisse passer. */
function domaineAccepteLeCourrier(string $courriel): bool
{
    if (!function_exists('checkdnsrr')) {
        return true;
    }
    $domaine = substr((string) strrchr($courriel, '@'), 1);
    if ($domaine === '') {
        return false;
    }
    if (checkdnsrr($domaine, 'MX') || checkdnsrr($domaine, 'A')) {
        return true;
    }
    $resolutionMarche = checkdnsrr(DOMAINE_TEMOIN, 'MX') || checkdnsrr(DOMAINE_TEMOIN, 'A');
    return !$resolutionMarche;
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

const PROFILS = [
    'Investisseur ou financeur',
    'Studio',
    'Créateur indépendant',
    'Autre',
];

$nom     = uneLigne($_POST['nom'] ?? '');
$courriel = uneLigne($_POST['email'] ?? '');
$profil  = parmi(propre($_POST['profil'] ?? ''), PROFILS);
$message = propre($_POST['message'] ?? '');

$erreurs = [];

if ($nom === '') {
    $erreurs['nom'] = 'Merci d’indiquer votre nom.';
} elseif (longueur($nom) > 100) {
    $erreurs['nom'] = 'Ce nom est trop long.';
}

if ($courriel === '') {
    $erreurs['email'] = 'Merci d’indiquer votre e-mail.';
} elseif (!filter_var($courriel, FILTER_VALIDATE_EMAIL) || longueur($courriel) > 160) {
    $erreurs['email'] = 'Cette adresse e-mail ne semble pas valide.';
} elseif (!domaineAccepteLeCourrier($courriel)) {
    $erreurs['email'] = 'Ce domaine ne reçoit pas de courrier. Vérifiez votre adresse.';
}

if (longueur($message) < 10) {
    $erreurs['message'] = 'Merci d’écrire quelques mots.';
} elseif (longueur($message) > 5000) {
    $erreurs['message'] = 'Ce message est trop long.';
}

if ($erreurs !== []) {
    repondre(422, ['ok' => false, 'erreurs' => $erreurs]);
}

/* --------------------------------------------------------------- l’envoi */

$corps = implode("\n", [
    'Nouveau message depuis aisina.net',
    '',
    'Nom      : ' . $nom,
    'E-mail   : ' . $courriel,
    'Profil   : ' . ($profil !== '' ? $profil : 'non précisé'),
    '',
    'Message :',
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

$sujetLisible = 'Contact aisina.net — ' . $nom;
$essai = enLocal();
$parti = $essai
    ? journaliser($sujetLisible, $corps, $entetes)
    : mail(DESTINATAIRE, motEncode($sujetLisible), $corps, $entetes, '-f' . EXPEDITEUR);

if (!$parti) {
    error_log('aisina/contact.php : envoi impossible pour ' . $courriel);
    repondre(500, ['ok' => false, 'message' => $essai
        ? 'Mode test : impossible d’écrire ' . JOURNAL_TEST . '. Vérifiez les droits du dossier.'
        : 'L’envoi a échoué. Écrivez-nous directement à ' . DESTINATAIRE . '.']);
}

noterEnvoi();
repondre(200, $essai ? ['ok' => true, 'test' => true] : ['ok' => true]);
