<?php
namespace Osynapsy\Ai\ChatBot\Model;

use Osynapsy\Database\Record\Active as ActiveRecord;

/**
 * Description of AiChat
 *
 * @author Pietro Celeste <p.celeste@qanda.cc>
 */
class AiChatMessage extends ActiveRecord
{
    public function table()
    {
        return 'tbl_ai_cht_msg';
    }

    public function primaryKey()
    {
        return ['id'];
    }

    public function fields()
    {
        return [
            'id',
            'id_cht',
            'role',
            'content',
            'reasoning',
            'dat_ins',
            'dat_upd',
            'dat_del'
        ];
    }

    protected function beforeInsert()
    {
        $this->setValue('dat_ins', date('Y-m-d H:i:s'));
        $this->setValue('dat_upd', date('Y-m-d H:i:s'));
    }

    protected function beforeUpdate()
    {
        $this->setValue('dat_upd', date('Y-m-d H:i:s'));
    }

    protected function softDelete()
    {
        return ['dat_del' => date('Y-m-d H:i:s')];
    }

    protected function extensionFactory()
    {
        $this->extend(new AiChatMessageProp, ['id_msg']);
    }
}