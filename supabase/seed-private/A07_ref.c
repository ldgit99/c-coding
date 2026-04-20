#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 1;
    int *arr = malloc(sizeof(int) * n);
    if (!arr) return 1;
    for (int i = 0; i < n; i++) scanf("%d", &arr[i]);
    for (int i = n - 1; i >= 0; i--) {
        printf("%d", arr[i]);
        if (i > 0) printf(" ");
    }
    printf("\n");
    free(arr);
    return 0;
}
