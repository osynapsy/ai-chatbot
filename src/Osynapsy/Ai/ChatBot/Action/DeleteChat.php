<?php
namespace Osynapsy\Ai\ChatBot\Action;

use Osynapsy\Action\AbstractAction;
use Osynapsy\Assert\Assertion;
use Osynapsy\Ai\ChatBot\Model\AiChat;

/**
 * Description of DeleteChat
 *
 * @author Pietro Celeste <p.celeste@qanda.cc>
 */
class DeleteChat extends AbstractAction
{
    public function execute($chatId)
    {
        try {
            Assertion::notEmpty($chatId, 'Oopss qualcosa è andato storto chatId non inviato');
            $Chat = (new AiChat)->where(['id' => $chatId]);
            if ($Chat('id')) {
                $Chat->delete();
            }
            $this->getController()->refreshComponents(['osy-chatbot-chat-list']);
        } catch(\Exception $e) {
            return $e->getMessage();
        }
    }
}
