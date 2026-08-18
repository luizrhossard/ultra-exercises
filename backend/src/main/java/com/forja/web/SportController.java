package com.forja.web;

import com.forja.repository.SportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/sports")
@RequiredArgsConstructor
public class SportController {

    private final SportRepository sports;

    record SportDto(Long id, String code, String name, String description) {
    }

    @GetMapping
    List<SportDto> all() {
        return sports.findAllByOrderByNameAsc().stream()
                .map(s -> new SportDto(s.getId(), s.getCode(), s.getName(), s.getDescription()))
                .toList();
    }
}
