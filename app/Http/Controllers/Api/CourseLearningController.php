<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CourseLearningGuide;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CourseLearningController extends Controller
{
    public function show(Request $request, CourseLearningGuide $guide)
    {
        $levels = app(CourseController::class)->index($request)->getData(true)['data'];

        return response()->json(['data' => $guide->next((int) $request->user()->id, $levels, (int) ($request->user()->course_target_score ?? 80))])
            ->header('Cache-Control', 'private, no-store');
    }

    public function update(Request $request)
    {
        $data = $request->validate(['target' => ['required', 'integer', Rule::in(CourseLearningGuide::TARGETS)]]);
        $request->user()->forceFill(['course_target_score' => $data['target']])->save();

        return response()->json(['data' => ['target' => (int) $data['target']]])->header('Cache-Control', 'private, no-store');
    }
}
