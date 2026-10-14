package com.rajasoftware.leavemanagement.controller;

import com.rajasoftware.leavemanagement.dto.LeaveResponseDto;
import com.rajasoftware.leavemanagement.exception.GlobalExceptionHandler;
import com.rajasoftware.leavemanagement.exception.InvalidLeaveRequestException;
import com.rajasoftware.leavemanagement.exception.LeaveNotFoundException;
import com.rajasoftware.leavemanagement.model.LeaveStatus;
import com.rajasoftware.leavemanagement.model.LeaveType;
import com.rajasoftware.leavemanagement.service.LeaveService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(LeaveController.class)
@Import(GlobalExceptionHandler.class)
class LeaveControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private LeaveService leaveService;

    @Test
    void getAllReturnsTheLeavesFromTheService() throws Exception {
        when(leaveService.getAll()).thenReturn(List.of(sample(1L)));

        mockMvc.perform(get("/leaves"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].employeeId").value("E1024"))
                .andExpect(jsonPath("$[0].leaveType").value("SICK"))
                .andExpect(jsonPath("$[0].status").value("PENDING"));
    }

    @Test
    void getByIdReturnsOneLeave() throws Exception {
        when(leaveService.getById(1L)).thenReturn(sample(1L));

        mockMvc.perform(get("/leaves/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reason").value("Fever"));
    }

    @Test
    void getByIdReturns404WhenTheLeaveIsMissing() throws Exception {
        when(leaveService.getById(99L)).thenThrow(new LeaveNotFoundException(99L));

        mockMvc.perform(get("/leaves/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Leave request 99 was not found."));
    }

    @Test
    void createReturns201AndTheLocationHeader() throws Exception {
        when(leaveService.create(any())).thenReturn(sample(4L));

        mockMvc.perform(post("/leaves")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody()))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/leaves/4"))
                .andExpect(jsonPath("$.id").value(4));
    }

    @Test
    void createReturns400AndNamesTheMissingField() throws Exception {
        mockMvc.perform(post("/leaves")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "leaveType": "SICK",
                                  "startDate": "2026-11-02",
                                  "endDate": "2026-11-03",
                                  "reason": "Fever"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("employeeId"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("employeeId is required"));

        verify(leaveService, never()).create(any());
    }

    @Test
    void createReturns400WhenTheEndDateIsBeforeTheStartDate() throws Exception {
        mockMvc.perform(post("/leaves")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "employeeId": "E1024",
                                  "leaveType": "CASUAL",
                                  "startDate": "2026-11-05",
                                  "endDate": "2026-11-01",
                                  "reason": "Family function"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("endDate"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("endDate must be on or after startDate"));
    }

    @Test
    void createReturns409WhenTheServiceRejectsAnOverlap() throws Exception {
        when(leaveService.create(any())).thenThrow(new InvalidLeaveRequestException(
                HttpStatus.CONFLICT,
                "This employee already has a pending or approved leave that overlaps those dates."
        ));

        mockMvc.perform(post("/leaves")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void updateReturnsTheUpdatedLeave() throws Exception {
        when(leaveService.update(eq(1L), any())).thenReturn(sample(1L));

        mockMvc.perform(put("/leaves/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void deleteReturns204() throws Exception {
        mockMvc.perform(delete("/leaves/1"))
                .andExpect(status().isNoContent());

        verify(leaveService).delete(1L);
    }

    @Test
    void deleteReturns404WhenTheLeaveIsMissing() throws Exception {
        org.mockito.Mockito.doThrow(new LeaveNotFoundException(8L)).when(leaveService).delete(8L);

        mockMvc.perform(delete("/leaves/8"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Leave request 8 was not found."));
    }

    private LeaveResponseDto sample(Long id) {
        return new LeaveResponseDto(
                id,
                "E1024",
                LeaveType.SICK,
                LocalDate.of(2026, 11, 2),
                LocalDate.of(2026, 11, 3),
                "Fever",
                LeaveStatus.PENDING
        );
    }

    private String validBody() {
        return """
                {
                  "employeeId": "E1024",
                  "leaveType": "SICK",
                  "startDate": "2026-11-02",
                  "endDate": "2026-11-03",
                  "reason": "Fever"
                }
                """;
    }
}
