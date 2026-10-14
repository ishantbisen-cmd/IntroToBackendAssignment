package com.rajasoftware.leavemanagement.controller;

import com.rajasoftware.leavemanagement.dto.LeaveRequestDto;
import com.rajasoftware.leavemanagement.dto.LeaveResponseDto;
import com.rajasoftware.leavemanagement.service.LeaveService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/leaves")
public class LeaveController {

    private final LeaveService leaveService;

    public LeaveController(LeaveService leaveService) {
        this.leaveService = leaveService;
    }

    @GetMapping
    public List<LeaveResponseDto> getAll() {
        return leaveService.getAll();
    }

    @GetMapping("/{id}")
    public LeaveResponseDto getById(@PathVariable Long id) {
        return leaveService.getById(id);
    }

    @PostMapping
    public ResponseEntity<LeaveResponseDto> create(@Valid @RequestBody LeaveRequestDto request) {
        LeaveResponseDto created = leaveService.create(request);
        return ResponseEntity.created(URI.create("/leaves/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    public LeaveResponseDto update(@PathVariable Long id, @Valid @RequestBody LeaveRequestDto request) {
        return leaveService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        leaveService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
