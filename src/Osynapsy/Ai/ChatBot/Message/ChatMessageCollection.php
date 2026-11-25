<?php
namespace Osynapsy\Ai\ChatBot\Message;

use Osynapsy\Ai\ChatBot\Model\AiChat;
use Osynapsy\Ai\ChatBot\Model\AiChatMessage;
use Osynapsy\Ai\Message\MessageCollection;

/**
 * Description of ChatMessageCollection
 *
 * @author Pietro Celeste <p.celeste@qanda.cc>
 */
class ChatMessageCollection extends MessageCollection implements PersistentMessageCollection
{
    protected $db;
    protected $userId;

    public function __construct($id, $userId, $db)
    {
        $this->id = $id;
        $this->userId = $userId;
        $this->db = $db;
    }

    public function chat(): \Osynapsy\ActiveRecord\ActiveRecord
    {
        return new AiChat;
    }

    public function message(): \Osynapsy\ActiveRecord\ActiveRecord
    {
        return new AiChatMessage;
    }

    public function reload() : static
    {
        $rs = $this->db->findAssoc(
           "SELECT  m.id,
                    m.role,
                    m.content,
                    p.id_prp AS prop,
                    p.val AS  prop_val
            FROM tbl_ai_cht_msg m
            LEFT JOIN tbl_ai_cht_msg_prp p ON m.id = p.id_msg
            WHERE m.id_cht = ?
            ORDER BY m.id",
           [$this->id]
        );
        $messages = [];
        foreach ($rs as $rec) {
            $id = $rec['id'];
            $prop = $rec['prop'];
            if (!array_key_exists($id, $messages)) {
                $messages[$id] = [
                    '__id__' => $id,
                    'role' => $rec['role'],
                    'content' => $rec['content']
                ];
            }
            if (!empty($prop)) {
                $messages[$id][$prop] = @unserialize($rec['prop_val']) ?: $rec['prop_val'];
            }
        }
        $this->messages = array_values($messages);
        return $this;
    }

    public function save($chatTitle = null, $host = null, $model = null) : mixed
    {
         $Chat = $this->chat();
         $Chat->where(['id' => $this->id]);
         if (empty($Chat('id'))) {
            $Chat->save([
                'id_usr' => $this->userId,
                'dat_ins' => date('Y-m-d'),
                'hst' => $host,
                'mdl' => $model,
                'ttl' => $chatTitle ?? 'no title',
                'is_cur' => 1
            ]);
         }
         $Message = $this->message();
         foreach($this->all() as $msg) {
             if (($msg['role'] ?? '') === 'system') {
                continue;
             }
             if(!empty($msg['__id__'])) {
                 continue;
             }
             $dbmsg = array_map(fn($v) => is_object($v) || is_array($v) ? serialize($v) : $v, $msg);
             $dbmsg['id_cht'] = $Chat('id');
             $Message->reset()->save($dbmsg);
         }
         return $Chat('id');
    }
}
