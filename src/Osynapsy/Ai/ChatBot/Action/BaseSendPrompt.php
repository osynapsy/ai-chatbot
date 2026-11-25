<?php
namespace Osynapsy\Ai\ChatBot\Action;

use Osynapsy\Action\AbstractAction;
use Osynapsy\Ai\Client;
use Osynapsy\Ai\Message\MessageCollection;
use Osynapsy\Ai\ChatBot\Message\ChatMessageCollection;
use Osynapsy\Ai\Prompt\Prompt;

/**
 * Description of BaseSendPrompt
 *
 * @author Pietro Celeste <p.celeste@osynapsy.net>
 */
class BaseSendPrompt extends AbstractAction
{
    protected function generateTitle($Client, $payloadClass, $model, $prompt)
    {
        // 1. Creiamo una MessageCollection dedicata e isolata per il titolo
        $messages = new MessageCollection(null);
        $messages->addSystem("Sei un generatore di titoli per chat. Genera un titolo estremamente breve (massimo 5-6 parole) che riassuma la richiesta dell'utente. Rispondi SOLO con il titolo, senza virgolette, senza prefissi, senza punteggiatura finale.");
        $messages->addUser($prompt);
        // 2. Prepariamo il Payload (senza tool, temperatura bassa per massima precisione)
        $payload = (new $payloadClass($model, $messages))->setTemperature(0.2);
        // 3. Inviamo la richiesta
        try {
            $response = $Client->send($payload);
            $title = $response->getContent();
            // Pulizia finale di sicurezza
            return trim($title, " \"'\n\r\t");
        } catch (\Exception $e) {
            // Fallback elegante in caso di errore di rete o timeout del modello
            return mb_substr($prompt, 0, 35) . '...';
        }
    }

    protected function clientFactory($host, $secret)
    {
        return new Client($host, $secret);
    }

    protected function promptFactory($request, $rawimages = null, $imageStoragePath = null)
    {
        $images = empty($rawimages) ? [] : (json_decode($rawimages, true) ?? []);
        $Prompt = new Prompt;
        $Prompt->addRequest($request);
        if (!empty($images)) {
            foreach($images as $image) {
                $Prompt->addImage($image, $imageStoragePath);
            }
        }
        return $Prompt;
    }

    protected function messageCollectionFactory($chatId, $Prompt, $systemPromptPath, array $placeholders = [])
    {
        $history = new ChatMessageCollection($chatId, session('userId'), $this->getDb());
        $history->reload()->loadSystem($systemPromptPath, $placeholders);
        $history->addUser($Prompt->getText(), $Prompt->getImages());
        return $history;
    }

    public function sendStreamToBrowser($raw, $Payload)
    {
        $chunk = $Payload->extractChunk($raw);   // ['type' => 'content'|'reasoning', 'text' => '...'] oppure null
        if ($chunk === null) {
            return;                              // keep-alive, [DONE], riga senza testo
        }
        $this->getController()->remoteCall("myAiChat.streamWrite", json_encode($chunk));
    }
}
