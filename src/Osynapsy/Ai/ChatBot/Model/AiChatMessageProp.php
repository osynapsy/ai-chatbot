<?php
namespace Osynapsy\Ai\ChatBot\Model;

use Osynapsy\Database\Record\Eav;

/**
 * Description of AiChat
 *
 * @author Pietro Celeste <p.celeste@qanda.cc>
 */
class AiChatMessageProp extends Eav
{
    public function table()
    {
        return 'tbl_ai_cht_msg_prp';
    }

    public function primaryKey()
    {
        return ['id_msg', 'id_prp'];
    }

    public function attributeIdField()
    {
        return 'id_prp';
    }

    public function attributeValueField()
    {
        return 'val';
    }

    public function fields()
    {
        return [];
    }
}