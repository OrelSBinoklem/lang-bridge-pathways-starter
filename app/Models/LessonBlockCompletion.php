<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LessonBlockCompletion extends Model
{
    protected $fillable = ['user_id', 'lesson_block_id', 'completed_at'];

    protected function casts(): array { return ['completed_at' => 'datetime']; }

    public function user() { return $this->belongsTo(User::class); }
    public function block() { return $this->belongsTo(LessonBlock::class, 'lesson_block_id'); }
}
