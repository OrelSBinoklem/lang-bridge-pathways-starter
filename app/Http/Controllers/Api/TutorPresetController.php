<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Tutor\TutorPresets;
use App\Services\Credits\CreditWallet;
use Illuminate\Http\Request;

class TutorPresetController extends Controller
{
    public function index(TutorPresets $presets, CreditWallet $wallet)
    {
        return response()->json(['data' => ['presets' => $presets->all(), 'commission_percent' => $wallet->commission() / 100]])
            ->header('Cache-Control', 'no-store');
    }

    public function update(Request $request, string $preset, TutorPresets $presets, CreditWallet $wallet)
    {
        abort_unless($request->user()->isFrontendAdmin(), 403);
        $presets->save($preset, $request->all());
        return $this->index($presets, $wallet);
    }
}
