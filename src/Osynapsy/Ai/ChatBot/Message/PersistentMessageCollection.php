<?php
namespace Osynapsy\Ai\ChatBot\Message;

use Osynapsy\ActiveRecord\ActiveRecord;

/**
 * Description of PersistentMessageCollection
 *
 * @author Pietro Celeste <p.celeste@osynapsy.net>
 */
interface PersistentMessageCollection
{
   public function save() : mixed;

   public function chat() : ActiveRecord;

   public function message() : ActiveRecord;

   public function reload() : static;
}
