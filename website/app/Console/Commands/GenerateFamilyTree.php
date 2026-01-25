<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Person;
use App\Services\FamilyTreeService;

class GenerateFamilyTree extends Command
{
    protected $signature = 'family:tree {person?} {--depth=3} {--format=html}';
    protected $description = 'Generate family tree for a person';

    public function handle()
    {
        $personId = $this->argument('person');
        $depth = $this->option('depth');
        $format = $this->option('format');

        if (!$personId) {
            $personId = $this->ask('Enter person ID or national ID:');
        }

        $person = Person::where('person_id', $personId)
            ->orWhere('national_id', $personId)
            ->first();
            
        if (!$person) {
            $this->error('Person not found!');
            return;
        }
        
        $service = new FamilyTreeService();
        $tree = $service->generateTree($person->person_id, $depth);
        
        if ($format === 'json') {
            $this->line(json_encode($tree, JSON_PRETTY_PRINT));
        } else {
            $this->displayTree($tree);
        }
    }
    
    protected function displayTree($tree)
    {
        $this->info("Family Tree for: {$tree['person']['full_name_arabic']}");
        $this->line(str_repeat('=', 50));
        
        $this->displayNode($tree, 0);
    }
    
    protected function displayNode($node, $level)
    {
        $prefix = str_repeat('  ', $level) . ($level > 0 ? '├── ' : '');
        $this->line($prefix . $node['person']['full_name_arabic']);
        
        foreach ($node['parents'] as $parent) {
            $this->displayNode($parent, $level + 1);
        }
        
        foreach ($node['children'] as $child) {
            $this->displayNode($child, $level + 1);
        }
    }
}
