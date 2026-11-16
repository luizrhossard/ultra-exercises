package com.forja.web;

import com.forja.service.TrainingChatService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/training-chat")
@RequiredArgsConstructor
public class TrainingChatController {
    private final TrainingChatService service;
    public record ChatRequest(@NotNull @Positive Long sportId, @NotEmpty @Size(max=20) List<TrainingChatService.Message> messages) {}
    public record SaveRequest(@NotBlank @Size(max=36) String proposalId) {}
    @PostMapping
    public TrainingChatService.Reply chat(Authentication auth, @Valid @RequestBody ChatRequest request) {
        return service.chat(auth.getName(), request.sportId(), request.messages());
    }
    @PostMapping("/save")
    public Map<String, Long> save(Authentication auth, @Valid @RequestBody SaveRequest request) {
        return Map.of("id", service.save(auth.getName(), request.proposalId()));
    }
}
