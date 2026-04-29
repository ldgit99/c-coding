#include <stdio.h>

int main() {

    int i, j;
    int arr[5][4] = {
        {1, 2, 3, 0},
        {5, 6, 7, 0},
        {9, 10, 11, 0},
        {13, 14, 15, 0},
        {0, 0, 0, 0}
    };

    for (i = 0; i < 4; i++) {
        int sumrow = 0;
        for (j = 0; j < 3; j++) {
            sumrow += arr[i][j];
        }
        arr[i][3] = sumrow;
    }

    for (j = 0; j < 4; j++) {
        int sumcol = 0;
        for (i = 0; i < 4; i++) {
            sumcol += arr[i][j];
        }
        arr[4][j] = sumcol;
    }

    for (i = 0; i < 5; i++) {
        for (j = 0; j < 4; j++) {
            printf("%3d", arr[i][j]);
        }
        printf("\n");
    }

    return 0;
}
