<?php
namespace Osynapsy\Ai\ChatBot\Model;

use Osynapsy\Database\Record\Active as ActiveRecord;

/**
 * Description of AiChat
 *
 * @author Pietro Celeste <p.celeste@qanda.cc>
 */
class AiChat extends ActiveRecord
{
    public function table()
    {
        return 'tbl_ai_cht';
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
            'id_usr',
            'hst',
            'mdl',
            'ttl',
            'is_cur',
            'dat_ins',
            'dat_upd',
            'dat_del'
        ];
    }
}