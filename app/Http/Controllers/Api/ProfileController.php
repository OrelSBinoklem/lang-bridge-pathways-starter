<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserDictionaryWord;
use Illuminate\Support\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function updatePreferredLearnLang(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'preferred_learn_lang' => ['required', 'string', 'in:lv,en,LV,EN'],
        ]);

        $lang = strtolower($validated['preferred_learn_lang']);
        $user = $request->user();
        $user->preferred_learn_lang = $lang;
        $user->save();

        return response()->json([
            'user' => $user,
        ]);
    }

    public function progress(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'dictionary_id' => ['required', 'integer', 'exists:dictionaries,id'],
        ]);

        // Old clients keep ISO dates; new clients opt into raw UTC database dates.
        $rawDates = $request->query('date_format') === 'raw' && config('app.timezone') === 'UTC';
        $rows = UserDictionaryWord::query()
            ->where('user_id', $request->user()->id)
            ->whereHas('word', fn ($q) => $q->where('dictionary_id', $validated['dictionary_id']))
            ->toBase()
            ->get()
            ->map(function (object $row) use ($rawDates): object {
                // Keep the existing JSON contract without hydrating every Eloquent model.
                foreach (['easy_education', 'mode_education', 'mode_education_revert',
                    'easy_correct', 'easy_correct_revert', 'is_reset'] as $field) {
                    if (isset($row->$field)) {
                        $row->$field = (bool) $row->$field;
                    }
                }
                foreach ($rawDates ? [] : ['last_shown', 'last_shown_revert', 'created_at', 'updated_at'] as $field) {
                    if (isset($row->$field)) {
                        $row->$field = Carbon::parse($row->$field, config('app.timezone'))->toJSON();
                    }
                }

                return $row;
            });

        return response()->json([
            'data' => $rows,
            ...($rawDates ? ['timezone' => 'UTC'] : []),
        ]);
    }
}
